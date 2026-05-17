# syntax=docker/dockerfile:1.7
#
# Build context is the REPO ROOT (see compose.yml). The web app is part of an
# npm workspace that also includes packages/stack-client, so the package files
# for every workspace must be visible to `npm install` for the @stack/client
# symlink to resolve.

# node:22-slim (Debian) rather than alpine: Tailwind v4's CLI eagerly loads
# @parcel/watcher, which only ships musl prebuilds for some platforms and
# breaks on alpine arm64 when the lockfile was generated on a different
# platform. Slim image is ~80MB larger but the install Just Works.
FROM node:22-slim AS web-build
WORKDIR /src

# 1. Copy the manifests for every workspace first so the install layer caches
#    against changes to ANY package.json without invalidating on every code edit.
COPY package.json package-lock.json* ./
COPY packages/stack-client/package.json ./packages/stack-client/
COPY web/package.json ./web/

# 2. Install with --include-workspace-root so npm wires the @stack/client
#    symlink + installs all workspace deps in one pass.
#
#    We delete any incoming package-lock.json before installing because npm's
#    workspace hoisting pins optional platform-specific binaries (e.g.
#    @parcel/watcher-darwin-arm64) from the lockfile-generating host. When
#    that lockfile is built on a Mac and we install on linux, the
#    linux-glibc variant gets skipped silently and the build later crashes
#    with "No prebuild or local build of @parcel/watcher found."
#    Letting npm re-resolve in-container guarantees the right variant lands.
RUN --mount=type=cache,target=/root/.npm \
    rm -f package-lock.json web/package-lock.json packages/*/package-lock.json && \
    npm install --include-workspace-root --include=optional

# 3. Now copy source. Split from manifests so source edits don't reinstall.
COPY packages/stack-client/ ./packages/stack-client/
COPY web/ ./web/

# 4. Build the web bundle from the web workspace.
WORKDIR /src/web
RUN npm run build

# ----------------------------------------------------------------------------
# Go binary that serves the built static assets + proxies /api → server.

FROM golang:1.25-alpine AS go-build
WORKDIR /src
COPY web/go.mod web/go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY web/cmd ./cmd
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/web ./cmd/web

# ----------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=go-build /out/web /app/web
COPY --from=web-build /src/web/dist /app/dist
ENV DIST_DIR=/app/dist
ENV ADDR=:8081
USER nonroot:nonroot
EXPOSE 8081
ENTRYPOINT ["/app/web"]

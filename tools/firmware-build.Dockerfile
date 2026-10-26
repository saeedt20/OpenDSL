FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587

# Build dependencies are confined to this image. Downloaded SDK programs are
# inspected separately and run only in a network-disabled build container.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential bison flex gawk gettext libxml2-dev zlib1g-dev \
    libc6-i386 lib32stdc++6 libstdc++5 fakeroot python3 python3-pyelftools \
    file xz-utils patch ca-certificates && rm -rf /var/lib/apt/lists/*
ENV LC_ALL=C TZ=UTC
WORKDIR /work

# Build stage
FROM node:22-slim AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production

# Final stage
FROM node:22-slim

# Install Chrome dependencies and Chrome itself
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf

WORKDIR /app

# Copy only the necessary files from builder
COPY --from=builder /build/node_modules ./node_modules
COPY screenshots ./screenshots
COPY screenshot.js .

# Set environment variable to tell Puppeteer where Chrome is installed
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Fix permissions for the screenshots directory
RUN mkdir -p /app/screenshots && chown -R node:node /app/screenshots

# Run as non-root user for security
USER node
CMD ["node", "screenshot.js"]

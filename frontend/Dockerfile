# FROM node:18-alpine

# WORKDIR /app

# # Copy package files first for caching
# COPY package.json package-lock.json ./

# # Install dependencies
# RUN npm install

# # Copy source code
# COPY . .

# # Vite runs on 5173 by default, but we configured it to 3000 in vite.config.js
# EXPOSE 3000

# # Bind to 0.0.0.0 so Docker can map ports
# CMD ["npm", "run", "dev"]
# Change from node:18-alpine to node:22-alpine
# FROM node:22-alpine

# WORKDIR /app

# # Copy package files first for caching
# COPY package.json package-lock.json ./

# # Install dependencies
# RUN npm install

# # Copy source code
# COPY . .

# EXPOSE 3000

# # Bind to 0.0.0.0 so Docker can map ports
# CMD ["npm", "run", "dev", "--", "--host"]

FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies 
# We use 'ci' for faster, more reliable builds if you have a lockfile
RUN npm install

# Copy source code
COPY . .

# Fix permissions for the node_modules binaries
# This ensures 'vite' can be executed even if the mount messes with flags
RUN chmod -R +x /app/node_modules/.bin

EXPOSE 3000

# Ensure we use the 'node' user for better security, 
# but only if your volume mounts allow it. 
# For now, we stay as root to fix the permission issue.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
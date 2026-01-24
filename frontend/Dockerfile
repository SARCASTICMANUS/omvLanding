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
FROM node:22-alpine

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

# Bind to 0.0.0.0 so Docker can map ports
CMD ["npm", "run", "dev", "--", "--host"]
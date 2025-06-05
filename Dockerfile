# Use Node.js 22 base image
FROM public.ecr.aws/docker/library/node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY app/package.json app/pnpm-lock.yaml ./

# Install dependencies using pnpm (preinstalled in your project)
RUN npm install -g pnpm && pnpm install

# Copy the rest of the NestJS app
COPY app .

# Build the NestJS app
RUN pnpm build

# Expose NestJS port (default is 3000)
EXPOSE 3000

# Start the app
CMD ["node", "dist/main"]

# Use Node.js 22 base image
FROM public.ecr.aws/docker/library/node:22-slim

# Install git (required by some dependencies)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files
COPY app/package.json app/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the app source
COPY app .

# Build the app
RUN yarn build

# Expose the default NestJS port
EXPOSE 3000

# Start the app
CMD ["node", "dist/main"]

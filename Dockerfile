# Use the official Node.js image
FROM node:22

# Set the working directory
WORKDIR /app

# Copy only the necessary files
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Accept build-time variables
ARG PORT
ARG MONGO_DB_URI
ARG MONGO_DB_NAME
ARG JWT_SECRET
ARG TOKEN_EXPIRES_IN
ARG ADMIN_DEFAULT_PASSWORD

# Set environment variables (optional — for runtime usage inside the container)
ENV PORT=$PORT
ENV MONGO_DB_URI=$MONGO_DB_URI
ENV MONGO_DB_NAME=$MONGO_DB_NAME
ENV JWT_SECRET=$JWT_SECRET
ENV TOKEN_EXPIRES_IN=$TOKEN_EXPIRES_IN
ENV ADMIN_DEFAULT_PASSWORD=$ADMIN_DEFAULT_PASSWORD

# Expose the port (if needed)
EXPOSE ${PORT}

# Build the application (if applicable)
RUN npm run build
# Start the application
CMD ["npm", "start"]

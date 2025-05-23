# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json) to leverage Docker cache
COPY package*.json ./

# Install production dependencies
#RUN npm install --production

# Bundle app source
#COPY src ./src

# The 'data' directory will be mounted as a volume, 
# but we create it here so permissions are set correctly by the app if needed initially.
RUN mkdir -p data/issues

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define environment variable for the node environment
ENV NODE_ENV=production

# Run the app when the container launches
CMD ["node", "src/server.js"]

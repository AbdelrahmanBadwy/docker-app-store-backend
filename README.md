# Docker App Store Service

This service provides a RESTful API to fetch application information from a Docker Registry. It is built with Node.js, Express, and TypeScript, following Clean Architecture principles.

## Features

-   Fetches all repositories from a Docker Registry.
-   Extracts metadata (name, description, picture) from image labels/annotations.
-   Exposes a single `/api/apps` endpoint to get an array of app data.
-   Provides interactive API documentation via Swagger/OpenAPI at `/api-docs`.

## Project Structure

```
docker-app-store-service/
│
├── src/
│   ├── application/ # Application business logic (use cases)
│   ├── domain/      # Core business entities and rules
│   ├── infrastructure/ # External concerns (DB, APIs, etc.)
│   ├── interfaces/  # Entry points (HTTP controllers, messaging consumers)
│   ├── shared/      # Shared code (config, logger)
│   └── server.ts    # Server entry point
│
├── .env             # Environment variables
├── Dockerfile       # Container definition for the service
├── docker-compose.yml # Local development setup
├── package.json
└── README.md
```

---

## Running Locally

The easiest way to run the service locally is with Docker and Docker Compose. This will spin up our Node.js service and a local Docker Registry for testing.

### Prerequisites

-   [Docker](https://www.docker.com/products/docker-desktop/)
-   [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Create Environment Files

Create a `.env` file in the root directory:

**.env**
```
PORT=3000
# This URL points to the registry service defined in docker-compose.yml
DOCKER_REGISTRY_URL=http://registry:5000
```

### 2. Create a Dockerfile

Create a `Dockerfile` to containerize the Node.js application.

**Dockerfile**
```dockerfile
# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine
WORKDIR /usr/src/app
# Copy only necessary files from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

### 3. Create a `docker-compose.yml`

This file defines the application service and a local Docker registry.

**docker-compose.yml**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./src:/usr/src/app/src # Mount source code for live-reloading with ts-node-dev
    env_file:
      - .env
    depends_on:
      - registry
    command: npm run dev

  registry:
    image: registry:2
    ports:
      - "5000:5000"
    environment:
      REGISTRY_STORAGE_DELETE_ENABLED: "true"
```

### 4. Build and Run

From your terminal, run:

```bash
docker-compose up --build
```

### 5. Test the Service

1.  **Push an image to your local registry:**
    -   First, pull an image or use one you have locally (e.g., `nginx`).
    -   Tag it to point to your local registry: `docker tag nginx:latest localhost:5000/my-first-app`
    -   Push it: `docker push localhost:5000/my-first-app`

2.  **Access the API:**
    -   Open your browser or a tool like Postman and go to `http://localhost:3000/api/apps`.
    -   You should see a JSON response with `"location": "my-first-app"`.

3.  **View the API Docs:**
    -   Navigate to `http://localhost:3000/api-docs` to see the interactive Swagger UI.

---

## Running on the Cloud (Deployment Guidelines)

Deploying to a cloud provider like AWS, Google Cloud, or Azure involves containerizing the application and using managed services.

### 1. Containerization (Production-Ready)

The provided `Dockerfile` is already optimized for production using a multi-stage build. This creates a smaller, more secure image.

### 2. Pushing the Image to a Cloud Registry

Before you can deploy, you need to push your Docker image to a managed container registry:
-   **AWS:** Amazon Elastic Container Registry (ECR)
-   **Google Cloud:** Google Artifact Registry
-   **Azure:** Azure Container Registry (ACR)

**Example (AWS ECR):**
```bash
# Authenticate Docker to your ECR registry
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <your-aws-account-id>.dkr.ecr.<your-region>.amazonaws.com

# Build the image
docker build -t my-app-store-service .

# Tag the image for ECR
docker tag my-app-store-service:latest <your-aws-account-id>.dkr.ecr.<your-region>[.amazonaws.com/my-app-store-service:latest](https://.amazonaws.com/my-app-store-service:latest)

# Push the image
docker push <your-aws-account-id>.dkr.ecr.<your-region>[.amazonaws.com/my-app-store-service:latest](https://.amazonaws.com/my-app-store-service:latest)
```

### 3. Choosing a Compute Service

You can run your container on various services:

-   **Serverless Containers:**
    -   **AWS App Runner / AWS Fargate:** Fully managed, automatically scales. Best for simplicity.
    -   **Google Cloud Run:** Fully managed serverless platform. Excellent for pay-per-use.
    -   **Azure Container Apps:** Serverless platform for running containerized apps and microservices.

-   **Orchestration Platforms (for more complex deployments):**
    -   **Amazon EKS (Kubernetes):** For large-scale, complex microservice architectures.
    -   **Google GKE (Kubernetes):** Managed Kubernetes service.
    -   **Azure AKS (Kubernetes):** Managed Kubernetes service.

### 4. Configuration for the Cloud

-   **Environment Variables:** Do not use `.env` files in production. Instead, inject configuration securely using the secrets management service of your cloud provider (e.g., AWS Secrets Manager, Google Secret Manager, Azure Key Vault) and pass them as environment variables to your container instances.

-   **Docker Registry URL:** The `DOCKER_REGISTRY_URL` must be updated to point to your cloud-based Docker Registry. This registry will need to be accessible from your running container (e.g., within the same VPC or with proper authentication).

-   **Authentication:** Your cloud's Docker Registry will likely require authentication. Your application's HTTP client (`axios`) will need to be configured to send an `Authorization` header with a token. Your container should be granted an IAM role or identity that has permission to read from the registry. This is more secure than hardcoding credentials.

### 5. CI/CD Pipeline

For a robust deployment, set up a CI/CD pipeline using tools like:
-   **GitHub Actions**
-   **GitLab CI/CD**
-   **AWS CodePipeline**
-   **Azure DevOps**

A typical pipeline would:
1.  Trigger on a push to the `main` branch.
2.  Run tests.
3.  Build the Docker image.
4.  Push the image to your cloud registry (e.g., ECR).
5.  Deploy the new image to your chosen compute service (e.g., update the service on AWS Fargate or Cloud Run).
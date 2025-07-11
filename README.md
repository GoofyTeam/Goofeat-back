# just to test deployment
# GOOFEAT-BACK

This repository contains Terraform code for deploying a backend application on AWS.

## Prerequisites

Before you begin, ensure you have the following:

- An AWS account  
- Terraform installed on your machine  
- AWS CLI configured with access credentials  

> **Note for Nix users:** If you use Nix, you can run `nix develop` in the project root to enter a development environment with Terraform.

## Infrastructures

- [**Backend Application on AWS**](./app_infra/README.md): Deploys a backend application using AWS ECS, ECR, and other services.

## Backend Application on AWS

This infrastructure deploys a backend application using Amazon ECS, ECR, and other AWS services. The setup includes creating an ECR repository, ECS cluster, task definitions, and configuring a CI/CD pipeline using AWS CodePipeline for automated builds and deployments.

### Components

- **ECR Repository:** Docker container registry for storing backend application images.  
- **ECS Cluster & Service:** Container orchestration service to manage and scale the backend application.  
- **CI/CD Pipeline:** Automates the build, test, and deployment phases using AWS CodePipeline and CodeBuild.  

### Deployment Steps

1. Clone the repository.
2. Navigate to the `/app_infra` directory.
3. Set your AWS environment variables:

    ```bash
    export AWS_ACCESS_KEY_ID=AKIA...
    export AWS_SECRET_ACCESS_KEY=abcd...
    export AWS_REGION=us-west-2
    ```

4. Initialize Terraform:

    ```bash
    terraform init
    ```

5. Apply the Terraform configuration:

    ```bash
    terraform apply
    ```

## Variable Configuration

The infrastructure requires specific variables to be set. Refer to the `variables.tf` file in each directory for the required values. Configure these variables according to your AWS environment and project requirements.

## Cleanup

To remove the deployed resources, run the following command in the respective infrastructure directory:

```bash
terraform destroy

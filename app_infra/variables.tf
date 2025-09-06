# variables.tf

variable "aws_region" {
  description = "The AWS region."
  type        = string
  default     = "eu-north-1"
}

variable "aws_account_id" {
  description = "The AWS account ID."
  type        = string
}

variable "image_tag" {
  description = "The tag of the Docker image."
  type        = string
  default     = "latest"
}

variable "image_repo_name" {
  description = "The name of the ECR repository."
  type        = string
}

variable "github_repo_owner" {
  description = "The GitHub repository owner."
  type        = string
  default     = "agahakan"
}

variable "github_repo_name" {
  description = "The GitHub repository name."
  type        = string
  default     = "dpsec-devops"
}

variable "github_branch" {
  description = "The branch in the GitHub repository to use."
  type        = string
  default     = "main"
}

variable "github_oauth_token" {
  description = "OAuth token for GitHub authentication."
  type        = string
  sensitive   = true
}

variable "cluster_name" {
  description = "The name of the ECS Cluster."
  type        = string
}

variable "service_name" {
  description = "The name of the ECS Service."
  type        = string
}

variable "file_name" {
  description = "The file name of the image definitions."
  type        = string
  default     = "imagedefinitions.json"
}

variable "db_host" {
  type        = string
  description = "Host"
}

variable "db_username" {
  type        = string
  description = "Master username for the database"
}

variable "db_password" {
  type        = string
  description = "Master password for the database"
  sensitive   = true
}

variable "db_port" {
  type        = number
  description = "DB port"
}

variable "db_name" {
  type        = string
  description = "Database name"
}

# secret.tf

resource "aws_secretsmanager_secret" "ghcr_credentials" {
  name = "ghcr-creds"
}

resource "aws_secretsmanager_secret_version" "ghcr_credentials_version" {
  secret_id     = aws_secretsmanager_secret.ghcr_credentials.id
  secret_string = jsonencode({
    username = var.github_repo_owner
    password = var.github_oauth_token
  })
}

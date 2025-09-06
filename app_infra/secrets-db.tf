# secrets-db.tf

resource "aws_secretsmanager_secret" "nestjs_db" {
  name = "nestjs-db"
}

resource "aws_secretsmanager_secret_version" "nestjs_db_version" {
  secret_id = aws_secretsmanager_secret.nestjs_db.id
  secret_string = jsonencode({
    DB_HOST = var.db_host
    DB_USER = var.db_username
    DB_PASS = var.db_password
  })
}

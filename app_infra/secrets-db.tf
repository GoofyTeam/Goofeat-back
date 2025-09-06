# secrets-db.tf

resource "aws_secretsmanager_secret" "nestjs_db" {
  name = "nestjs-db"
}

resource "aws_secretsmanager_secret_version" "nestjs_db_version" {
  secret_id = aws_secretsmanager_secret.nestjs_db.id
  secret_string = jsonencode({
    DB_HOST     = var.db_host
    DB_PORT     = tostring(var.db_port)
    DB_USERNAME = var.db_username
    DB_PASSWORD = var.db_password
    DB_DATABASE = var.db_name
  })
}

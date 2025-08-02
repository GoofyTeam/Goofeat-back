# rds.tf

resource "aws_db_subnet_group" "goofeat_db_subnet_group" {
  name       = "goofeat-db-subnet-group"
  subnet_ids = [aws_subnet.app_subnet_1.id, aws_subnet.app_subnet_2.id]

  tags = {
    Name = "Goofeat DB Subnet Group"
  }
}

resource "aws_security_group" "goofeat_db_sg" {
  name        = "goofeat-db-sg"
  description = "Allow ECS app access to RDS"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    # Allow from ECS app SG
    security_groups = [aws_security_group.goofeat_app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "goofeat_postgres" {
  identifier              = "goofeat-postgres"
  engine                  = "postgres"
  engine_version          = "14"
  instance_class          = "db.t4g.micro" # cheapest burstable instance
  allocated_storage       = 20
  storage_type            = "gp2"
  db_name                 = "goofeat"
  username                = var.db_username
  password                = var.db_password
  vpc_security_group_ids  = [aws_security_group.goofeat_db_sg.id]
  db_subnet_group_name    = aws_db_subnet_group.goofeat_db_subnet_group.name
  skip_final_snapshot     = true
  publicly_accessible     = false
  multi_az                = false
  backup_retention_period = 0
  deletion_protection     = false
  auto_minor_version_upgrade = true
  tags = {
    Name = "GoofeatPostgres"
  }
}

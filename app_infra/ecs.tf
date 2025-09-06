# ecs.tf

resource "aws_ecs_cluster" "goofeat_app" {
  name = var.cluster_name
}

resource "aws_ecs_task_definition" "goofeat_app" {
  family                   = "goofeat-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.task_definition_role.arn
  container_definitions = jsonencode([
    {
      name      = "goofeat-app",
      image     = local.image_ref,
      essential = true,
      portMappings = [
        {
          containerPort = 5000,
          hostPort      = 5000
        }
      ],
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.goofeat_app.name,
          "awslogs-region"        = var.aws_region,
          "awslogs-stream-prefix" = "goofeat-app"
        }
      },
      repositoryCredentials = {
        credentialsParameter = aws_secretsmanager_secret.ghcr_credentials.arn
      },
      secrets = [
        { name = "DB_HOST", valueFrom = "${aws_secretsmanager_secret.nestjs_db.arn}:DB_HOST::" },
        { name = "DB_PORT", valueFrom = "${aws_secretsmanager_secret.nestjs_db.arn}:DB_PORT::" },
        { name = "DB_USERNAME", valueFrom = "${aws_secretsmanager_secret.nestjs_db.arn}:DB_USERNAME::" },
        { name = "DB_PASSWORD", valueFrom = "${aws_secretsmanager_secret.nestjs_db.arn}:DB_PASSWORD::" },
        { name = "DB_DATABASE", valueFrom = "${aws_secretsmanager_secret.nestjs_db.arn}:DB_DATABASE::" },
      ]
    }
  ])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
}

resource "aws_cloudwatch_log_group" "goofeat_app" {
  name = "/ecs/goofeat-app"
}

resource "aws_ecs_service" "goofeat_app" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.goofeat_app.id
  task_definition = aws_ecs_task_definition.goofeat_app.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [aws_subnet.app_subnet_1.id, aws_subnet.app_subnet_2.id]
    security_groups  = [aws_security_group.goofeat_app.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.goofeat_app.arn
    container_name   = "goofeat-app"
    container_port   = 5000
  }
}

resource "aws_security_group" "goofeat_app" {
  name        = "goofeat-app"
  description = "Allow inbound traffic to goofeat app"
  vpc_id      = aws_vpc.app_vpc.id
  ingress {
    description      = "Allow HTTP from anywhere"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

resource "aws_lb_target_group" "goofeat_app" {
  name        = "goofeat-app"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.app_vpc.id
  target_type = "ip"
  health_check {
    path                = "/"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb" "goofeat_app" {
  name                       = "goofeat-app"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.goofeat_app.id]
  subnets                    = [aws_subnet.app_subnet_1.id, aws_subnet.app_subnet_2.id]
  enable_deletion_protection = false
  tags = {
    Name = "goofeat-app"
  }
}

resource "aws_lb_listener" "goofeat_app" {
  load_balancer_arn = aws_lb.goofeat_app.arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.goofeat_app.arn
  }
}

resource "aws_lb_listener_rule" "goofeat_app" {
  listener_arn = aws_lb_listener.goofeat_app.arn
  priority     = 1
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.goofeat_app.arn
  }
  condition {
    path_pattern {
      values = ["/"]
    }
  }
}

resource "aws_iam_role" "task_definition_role" {
  name               = "goofeat_task_definition"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role_policy.json
}

data "aws_iam_policy_document" "task_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    effect = "Allow"
  }
}

resource "aws_iam_role_policy" "task_definition_policy" {
  name   = "goofeat_task_definition_policy"
  role   = aws_iam_role.task_definition_role.id
  policy = data.aws_iam_policy_document.task_policy.json
}

data "aws_iam_policy_document" "task_policy" {
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetAuthorizationToken",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "secretsmanager:GetSecretValue",
      "ssm:GetParameters",
    ]
    resources = ["*"]
    effect    = "Allow"
  }
}

data "aws_caller_identity" "current" {}

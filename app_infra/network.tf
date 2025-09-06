# network.tf

resource "aws_vpc" "app_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "AppVPC"
  }
}

resource "aws_internet_gateway" "app_igw" {
  vpc_id = aws_vpc.app_vpc.id
  tags = {
    Name = "AppIGW"
  }
}

resource "aws_subnet" "app_subnet_1" {
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "eu-north-1a"
  map_public_ip_on_launch = true
  tags = {
    Name = "AppSubnet1"
  }
}

resource "aws_subnet" "app_subnet_2" {
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "eu-north-1b"
  map_public_ip_on_launch = true
  tags = {
    Name = "AppSubnet2"
  }
}

resource "aws_route_table" "app_rt" {
  vpc_id = aws_vpc.app_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app_igw.id
  }
  tags = {
    Name = "AppRouteTable"
  }
}

resource "aws_route_table_association" "a" {
  subnet_id      = aws_subnet.app_subnet_1.id
  route_table_id = aws_route_table.app_rt.id
}

resource "aws_route_table_association" "b" {
  subnet_id      = aws_subnet.app_subnet_2.id
  route_table_id = aws_route_table.app_rt.id
}

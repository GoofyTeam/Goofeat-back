# locals.tf
locals {
  image_tag = trimspace(var.image_tag) != "" ? trimspace(var.image_tag) : "latest"
  image_ref = "ghcr.io/goofyteam/goofeat-back:${local.image_tag}"
}

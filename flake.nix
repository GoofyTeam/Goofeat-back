{
  description = "Development environment with Terraform and Yarn";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        tf = pkgs.terraform.withPlugins (p: [
          p.aws
          # add others if you need them:
          # p.random p.null p.local p.tls p.archive p.template
        ]);
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [ tf pkgs.yarn pkgs.awscli2 ];

          shellHook = ''
            echo "Terraform environment ready (Nix-managed providers)"
          '';
        };
      });
}

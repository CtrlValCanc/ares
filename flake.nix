{
  description = "ARES: RISC-V Educational Simulator";

  inputs = {
    nixpkgs.url = "nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    self.submodules = true;
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        # Development shell (`nix develop`)
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            llvmPackages.clang-unwrapped
            lld
            libllvm
            gcc
            gnumake
            nodejs
          ];
        };

        packages = {
          # Build webui (`nix build -o dist`)
          default = pkgs.buildNpmPackage {
            src = ./.;
            name = "ares-webui";
            npmDepsHash = "sha256-CwsR0hqPgGT+KXH6EAkDdUvLMoK+ETRMIUKppWMgwGk";
            nativeBuildInputs = with pkgs; [
              llvmPackages.clang-unwrapped
              lld
            ];
            installPhase = ''
              mkdir -p $out
              cp -r --verbose dist/* $out/
            '';
          };

          # Build cli (`nix build .#cli -o bin`)
          cli = pkgs.stdenv.mkDerivation {
            src = ./.;
            name = "ares-cli";
            phases = ["unpackPhase" "buildPhase" "installPhase"];
            buildPhase = ''
              make
            '';
            installPhase = ''
              mkdir -p $out
              cp --verbose ares $out/
            '';
          };

          # Build cli test (`nix build .#cli-test -o bin`)
          cli-test = pkgs.stdenv.mkDerivation {
            src = ./.;
            name = "ares-cli";
            phases = ["unpackPhase" "buildPhase" "installPhase"];
            buildPhase = ''
              make ares_test
            '';
            installPhase = ''
              mkdir -p $out
              cp --verbose ares_test $out/
            '';
          };
        };
      }
    );
}

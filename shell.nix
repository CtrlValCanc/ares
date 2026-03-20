{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # clang for WASM
    llvmPackages.clang-unwrapped
    lld
    
    # Tools
    gnumake
    git
    
    # Web
    nodejs_latest
  ];

  shellHook = ''
    export CC=clang
    echo "Ares development environment loaded."
  '';
}

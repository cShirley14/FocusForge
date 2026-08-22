{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Core tooling
    just
    nodejs
    esbuild
    docker-compose

    # AWS
    aws-sam-cli
    awscli2
    python3Packages.awscrt  # Required for SSO/login credential provider
    python3Packages.diceware  # EFF passphrase generation for test credentials
    pwgen             # Industry-standard credential generation for ephemeral test users

    # Security scanning
    trufflehog        # Secret detection across filesystem and git history
    gitleaks          # Git-native secret scanning
    detect-secrets    # Baseline-aware secret scanning (Yelp)

    # Utilities
    jq
    curl
  ];

  shellHook = ''
    echo "⚒️  FocusForge dev shell ready"
    echo "   just --list  → see available recipes"
  '';
}

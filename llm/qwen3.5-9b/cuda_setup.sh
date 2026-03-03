#!/bin/bash
set -e

# ✨ WSL2 Ubuntu 22.04 用の CUDA Toolkit 12.4 セットアップスクリプトだよっ！ 🎀✨

echo "🚀 CUDA Repository を追加するねっ！"
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update

echo "🛠️ CUDA Toolkit をインストールするよっ！ちょっと時間がかかるかも... ✨"
sudo apt-get -y install cuda-toolkit-12-4

echo "✅ インストール完了！環境変数を設定してねっ 💖"
echo 'export PATH=/usr/local/cuda-12.4/bin${PATH:+:${PATH}}' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-12.4/lib64${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}' >> ~/.bashrc
echo 'export CUDA_HOME=/usr/local/cuda-12.4' >> ~/.bashrc

echo "✨ 全て完了！新しいターミナルを開くか 'source ~/.bashrc' してねっ！🎀💎"

#!/bin/bash

# Quick commit script for regular progress updates

echo "📝 Quick Commit Tool"
echo "==================="
echo ""

# Check git status
echo "📊 Current changes:"
git status --short
echo ""

# If no changes, exit
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No changes to commit!"
    exit 0
fi

# Ask for commit type
echo "Select commit type:"
echo "1) feat - New feature"
echo "2) fix - Bug fix"
echo "3) docs - Documentation"
echo "4) chore - Maintenance"
echo "5) wip - Work in progress"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
    1) TYPE="feat";;
    2) TYPE="fix";;
    3) TYPE="docs";;
    4) TYPE="chore";;
    5) TYPE="wip";;
    *) TYPE="wip";;
esac

# Get commit message
echo ""
read -p "Enter commit message: " MESSAGE

# Create full commit message
FULL_MESSAGE="$TYPE: $MESSAGE"

# Add all changes
git add .

# Commit
git commit -m "$FULL_MESSAGE"

# Push
echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully committed and pushed!"
    echo "Commit: $FULL_MESSAGE"
else
    echo ""
    echo "❌ Push failed. Try: git push origin main"
fi
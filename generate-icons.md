# PWA Icon Generation Guide

To generate the required PWA icons, you'll need to create the following sizes from your favicon.png:

## Required Icon Sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Maskable versions: 192x192, 512x512
- Shortcut icons: 96x96 for home and search

## Using ImageMagick (recommended):
```bash
# Install ImageMagick if not available
# brew install imagemagick (macOS)
# sudo apt-get install imagemagick (Ubuntu)

# Convert favicon to different sizes
convert public/favicon.png -resize 72x72 public/icons/icon-72x72.png
convert public/favicon.png -resize 96x96 public/icons/icon-96x96.png
convert public/favicon.png -resize 128x128 public/icons/icon-128x128.png
convert public/favicon.png -resize 144x144 public/icons/icon-144x144.png
convert public/favicon.png -resize 152x152 public/icons/icon-152x152.png
convert public/favicon.png -resize 192x192 public/icons/icon-192x192.png
convert public/favicon.png -resize 384x384 public/icons/icon-384x384.png
convert public/favicon.png -resize 512x512 public/icons/icon-512x512.png

# For maskable icons (add padding for safe zone)
convert public/favicon.png -resize 154x154 -background transparent -gravity center -extent 192x192 public/icons/icon-192x192-maskable.png
convert public/favicon.png -resize 410x410 -background transparent -gravity center -extent 512x512 public/icons/icon-512x512-maskable.png

# Shortcut icons
cp public/icons/icon-96x96.png public/icons/shortcut-home-96x96.png
cp public/icons/icon-96x96.png public/icons/shortcut-search-96x96.png
```

## Alternative: Online Tools
- Use PWA Builder (https://www.pwabuilder.com/) image generator
- Use Favicon Generator (https://realfavicongenerator.net/)

## After generating icons:
Delete this file and run: `rm generate-icons.md`
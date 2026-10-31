$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectPath = Split-Path $PSScriptRoot -Parent
$sourcePath = Join-Path $projectPath 'public/assets/branding/logo-symbol.png'
$outputPath = Join-Path $projectPath 'public/pwa'
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null
$source = [System.Drawing.Bitmap]::new($sourcePath)
try {
  $left = $source.Width; $top = $source.Height; $right = 0; $bottom = 0
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      if ($source.GetPixel($x, $y).A -gt 16) {
        $left = [Math]::Min($left, $x); $right = [Math]::Max($right, $x)
        $top = [Math]::Min($top, $y); $bottom = [Math]::Max($bottom, $y)
      }
    }
  }
  $crop = [System.Drawing.Rectangle]::new($left, $top, $right - $left + 1, $bottom - $top + 1)
  $variants = @(
    @{Size=192; Name='icon-192.png'; Fill=.84}, @{Size=512; Name='icon-512.png'; Fill=.84},
    @{Size=512; Name='icon-maskable-512.png'; Fill=.56}, @{Size=180; Name='apple-touch-icon.png'; Fill=.84},
    @{Size=32; Name='favicon-32.png'; Fill=.92}, @{Size=48; Name='favicon-48.png'; Fill=.92}
  )
  foreach ($variant in $variants) {
    $size = [int]$variant.Size
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#FFF4D6'))
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $scale = ($size * $variant.Fill) / [Math]::Max($crop.Width, $crop.Height)
      $width = [int]($crop.Width * $scale); $height = [int]($crop.Height * $scale)
      $target = [System.Drawing.Rectangle]::new([int](($size-$width)/2), [int](($size-$height)/2), $width, $height)
      $graphics.DrawImage($source, $target, $crop, [System.Drawing.GraphicsUnit]::Pixel)
      $bitmap.Save((Join-Path $outputPath $variant.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
} finally { $source.Dispose() }
Write-Output 'Ícones gerados a partir de logo-symbol.png.'

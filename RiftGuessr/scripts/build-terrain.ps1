param(
  [string]$CacheRoot = (Join-Path $env:TEMP 'riftguessr-map-source'),
  [string]$OutputRoot = (Join-Path $PSScriptRoot '../assets/terrain')
)

# Package the unmodified Season 14 game-camera capture into a local image pyramid.
Add-Type -AssemblyName System.Drawing
$mapWidth = 11537
$mapHeight = 9544
$tileSize = 1024
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]95)
$output = [System.IO.Path]::GetFullPath($OutputRoot)
New-Item -ItemType Directory -Path $output -Force | Out-Null

foreach ($scale in @(1, 2, 4)) {
  $directory = Join-Path $output ([string]$scale)
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $width = [int][Math]::Ceiling($mapWidth / $scale)
  $height = [int][Math]::Ceiling($mapHeight / $scale)
  for ($tileY = 0; $tileY -lt [Math]::Ceiling($height / $tileSize); $tileY++) {
    for ($tileX = 0; $tileX -lt [Math]::Ceiling($width / $tileSize); $tileX++) {
      $bitmap = [System.Drawing.Bitmap]::new([int][Math]::Min($tileSize, $width - $tileX * $tileSize), [int][Math]::Min($tileSize, $height - $tileY * $tileSize))
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.Clear([System.Drawing.Color]::Black)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      try {
        if ($scale -eq 1) {
          for ($sy = 0; $sy -lt 4; $sy++) { for ($sx = 0; $sx -lt 4; $sx++) {
            $sourceX = $tileX * 4 + $sx
            $sourceY = $tileY * 4 + $sy
            if ($sourceX * 256 -ge $mapWidth -or $sourceY * 256 -ge $mapHeight) { continue }
            $path = Join-Path $CacheRoot "6/$sourceX/$sourceY.png"
            $image = [System.Drawing.Image]::FromFile($path)
            try { $graphics.DrawImageUnscaled($image, $sx * 256, $sy * 256) } finally { $image.Dispose() }
          } }
        } else {
          for ($sy = 0; $sy -lt $scale; $sy++) { for ($sx = 0; $sx -lt $scale; $sx++) {
            $sourceX = $tileX * $scale + $sx
            $sourceY = $tileY * $scale + $sy
            $path = Join-Path $output "1/$sourceX-$sourceY.jpg"
            if (-not (Test-Path -LiteralPath $path)) { continue }
            $image = [System.Drawing.Image]::FromFile($path)
            try {
              $destination = [System.Drawing.RectangleF]::new([single]($sx * $tileSize / $scale), [single]($sy * $tileSize / $scale), [single]($image.Width / $scale), [single]($image.Height / $scale))
              $graphics.DrawImage($image, $destination, [System.Drawing.RectangleF]::new(0, 0, $image.Width, $image.Height), [System.Drawing.GraphicsUnit]::Pixel)
            } finally { $image.Dispose() }
          } }
        }
        $bitmap.Save((Join-Path $directory "$tileX-$tileY.jpg"), $jpeg, $parameters)
      } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
  }
  Write-Output "Packaged terrain at 1:$scale"
}

$preview = [System.Drawing.Bitmap]::new([int][Math]::Ceiling($mapWidth / 8), [int][Math]::Ceiling($mapHeight / 8))
$graphics = [System.Drawing.Graphics]::FromImage($preview)
try {
  for ($tileY = 0; $tileY -lt 5; $tileY++) { for ($tileX = 0; $tileX -lt 6; $tileX++) {
    $image = [System.Drawing.Image]::FromFile((Join-Path $CacheRoot "3/$tileX/$tileY.png"))
    try { $graphics.DrawImageUnscaled($image, $tileX * 256, $tileY * 256) } finally { $image.Dispose() }
  } }
  $preview.Save((Join-Path $output 'preview.jpg'), $jpeg, $parameters)
} finally { $graphics.Dispose(); $preview.Dispose() }
$manifest = [ordered]@{
  width = $mapWidth; height = $mapHeight; tileSize = $tileSize
  scales = @(1, 2, 4); previewScale = 8; preview = 'preview.jpg'
  pattern = '{scale}/{x}-{y}.jpg'
  label = 'Summoner''s Rift (Season 14)'
  source = 'https://summonersrift.mvilim.dev/'
}
[System.IO.File]::WriteAllText((Join-Path $output 'manifest.json'), ($manifest | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
$parameters.Dispose()
$files = Get-ChildItem -LiteralPath $output -File -Recurse
Write-Output "Packaged $($files.Count) files, $([Math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 1)) MB"

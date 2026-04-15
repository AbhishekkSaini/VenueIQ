Add-Type -AssemblyName System.Drawing

# OG Image 1200x630
$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 14, 26))
$g.FillRectangle($bgBrush, 0, 0, $w, $h)
$bgBrush.Dispose()

$accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 108, 99, 255))
$g.FillRectangle($accentBrush, 0, 0, 8, $h)
$accentBrush.Dispose()

for ($i = 6; $i -ge 0; $i--) {
    $alpha = 20 + $i * 12
    $pad = $i * 30
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 108, 99, 255))
    $g.FillEllipse($glowBrush, (900 - $pad), (-150 - $pad), (500 + $pad * 2), (500 + $pad * 2))
    $glowBrush.Dispose()
}

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Near
$sf.LineAlignment = [System.Drawing.StringAlignment]::Near

$titleFont = New-Object System.Drawing.Font("Arial", 96.0, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("VenueIQ", $titleFont, $titleBrush, 80.0, 180.0, $sf)
$titleFont.Dispose()
$titleBrush.Dispose()

$subFont = New-Object System.Drawing.Font("Arial", 32.0, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 108, 99, 255))
$g.DrawString("Smart Physical Event Platform", $subFont, $subBrush, 80.0, 310.0, $sf)
$subFont.Dispose(); $subBrush.Dispose()

$tagFont = New-Object System.Drawing.Font("Arial", 20.0, [System.Drawing.FontStyle]::Regular)
$tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 180, 200, 230))
$tagText = "AI-powered crowd flow  |  Real-time queue management  |  Emergency coordination"
$g.DrawString($tagText, $tagFont, $tagBrush, 80.0, 400.0, $sf)
$tagFont.Dispose(); $tagBrush.Dispose(); $sf.Dispose()

$g.Dispose()
$bmp.Save("d:\PhysicalEventExpo\assets\og-image.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Created og-image.png"

# Badge 72x72
$sz = 72
$bmp2 = New-Object System.Drawing.Bitmap($sz, $sz)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bg2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 108, 99, 255))
$g2.FillEllipse($bg2, 0, 0, $sz, $sz)
$bg2.Dispose()
$tf = New-Object System.Drawing.Font("Arial", 24.0, [System.Drawing.FontStyle]::Bold)
$tb = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$tsf = New-Object System.Drawing.StringFormat
$tsf.Alignment = [System.Drawing.StringAlignment]::Center
$tsf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g2.DrawString("V", $tf, $tb, (New-Object System.Drawing.RectangleF(0.0, 0.0, 72.0, 72.0)), $tsf)
$tf.Dispose(); $tb.Dispose(); $tsf.Dispose(); $g2.Dispose()
$bmp2.Save("d:\PhysicalEventExpo\assets\badge-72.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp2.Dispose()
Write-Host "Created badge-72.png"

# Screenshot helper
function Make-Screenshot([int]$W, [int]$H, [string]$Lbl, [string]$Path) {
    $b = New-Object System.Drawing.Bitmap($W, $H)
    $gg = [System.Drawing.Graphics]::FromImage($b)
    $gg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 14, 26))
    $gg.FillRectangle($bg, 0, 0, $W, $H)
    $bg.Dispose()
    $ac = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 108, 99, 255))
    $gg.FillRectangle($ac, 0, 0, $W, 6)
    $ac.Dispose()
    $fz = [float]([Math]::Max(24, [Math]::Min(48, $W / 25)))
    $lf = New-Object System.Drawing.Font("Arial", $fz, [System.Drawing.FontStyle]::Bold)
    $lb = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $ssf = New-Object System.Drawing.StringFormat
    $ssf.Alignment = [System.Drawing.StringAlignment]::Center
    $ssf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $fullLabel = "VenueIQ | " + $Lbl
    $gg.DrawString($fullLabel, $lf, $lb, (New-Object System.Drawing.RectangleF(0.0, 0.0, [float]$W, [float]$H)), $ssf)
    $lf.Dispose(); $lb.Dispose(); $ssf.Dispose(); $gg.Dispose()
    $b.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $b.Dispose()
    Write-Host "Created $Path"
}

Make-Screenshot 1280 720 "Operations Dashboard" "d:\PhysicalEventExpo\assets\screenshot-dashboard.png"
Make-Screenshot 1280 720 "Crowd Flow Analysis"  "d:\PhysicalEventExpo\assets\screenshot-crowd.png"
Make-Screenshot 390  844 "Mobile Dashboard"     "d:\PhysicalEventExpo\assets\screenshot-mobile.png"

Write-Host "Done. All assets generated."

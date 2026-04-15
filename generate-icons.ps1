Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param(
        [int]$Size,
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background: dark navy #0a0e1a
    $bgColor = [System.Drawing.Color]::FromArgb(255, 10, 14, 26)
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    $bgBrush.Dispose()

    # Glow rings
    $cx = [int]($Size / 2)
    $cy = [int]($Size / 2)
    $r = [int]($Size * 0.38)

    for ($i = 4; $i -ge 0; $i--) {
        $alpha = 30 + $i * 15
        $pad = [int]($i * $Size * 0.04)
        $glowColor = [System.Drawing.Color]::FromArgb($alpha, 108, 99, 255)
        $glowBrush = New-Object System.Drawing.SolidBrush($glowColor)
        $x = $cx - $r - $pad
        $y = $cy - $r - $pad
        $diameter = ($r + $pad) * 2
        $g.FillEllipse($glowBrush, $x, $y, $diameter, $diameter)
        $glowBrush.Dispose()
    }

    # Main purple circle
    $purpleColor = [System.Drawing.Color]::FromArgb(255, 108, 99, 255)
    $purpleBrush = New-Object System.Drawing.SolidBrush($purpleColor)
    $g.FillEllipse($purpleBrush, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
    $purpleBrush.Dispose()

    # Text "VQ"
    $fontSize = [float]($Size * 0.28)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textColor = [System.Drawing.Color]::White
    $textBrush = New-Object System.Drawing.SolidBrush($textColor)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, [float]$Size, [float]$Size)
    $g.DrawString("VQ", $font, $textBrush, $rect, $sf)

    $font.Dispose()
    $textBrush.Dispose()
    $sf.Dispose()
    $g.Dispose()

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Created: $OutPath ($Size x $Size)"
}

$dir = "d:\PhysicalEventExpo\assets"

Create-Icon -Size 72  -OutPath "$dir\icon-72.png"
Create-Icon -Size 96  -OutPath "$dir\icon-96.png"
Create-Icon -Size 128 -OutPath "$dir\icon-128.png"
Create-Icon -Size 192 -OutPath "$dir\icon-192.png"
Create-Icon -Size 512 -OutPath "$dir\icon-512.png"

Write-Host "All PWA icons generated."

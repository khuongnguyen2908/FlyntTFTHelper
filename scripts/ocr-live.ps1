# Đọc chữ trên màn hình TFT bằng OCR có sẵn của Windows (không cài gì), ghi web/live-ocr.js để web tự cập nhật.
# Chạy: bấm đúp Doc-man-hinh.bat (hoặc: powershell -ExecutionPolicy Bypass -File scripts\ocr-live.ps1)
# Thử trên ảnh có sẵn: powershell -ExecutionPolicy Bypass -File scripts\ocr-live.ps1 -Image shots\shot-....png
# Đọc: vòng, cấp + XP, vàng, máu của bạn, 5 tướng trong cửa hàng, tộc hệ đang kích, tên + máu các nhà.
# Không đọc được tướng trên bàn (hình 3D). Vùng đọc tính cho màn hình 16:9 (chuẩn 1920x1080, tự co giãn).
# Chỉ chụp màn hình, không đọc bộ nhớ game, không bấm hộ.
# File này phải lưu UTF-8 có BOM (PowerShell 5.1 đọc tiếng Việt).
param(
  [string]$Image,
  [double]$Interval = 2,
  [string]$Process = 'League of Legends',
  [switch]$Dump  # in chữ thô từng vùng (để chỉnh vùng đọc)
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$Root = Split-Path -Parent $PSScriptRoot
$OutFile = Join-Path $Root 'web\live-ocr.js'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class TftWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
}
'@
[void][TftWin]::SetProcessDPIAware()

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Wait-Op($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { Write-Host 'Windows không có OCR. Vào Settings > Language thêm English hoặc Tiếng Việt.'; exit 1 }

# Đọc chữ trong một vùng (toạ độ theo khung 1920x1080), phóng to $scale lần cho chữ nhỏ.
# $bin > 0: đổi sang đen trắng (chữ sáng -> đen trên nền trắng, ngưỡng $bin) và chừa lề, giúp đọc số nhỏ.
# $prefix: viết sẵn một chữ (vd "Gold") bên trái vùng đen trắng — OCR hay bỏ sót số đứng riêng, có chữ mồi thì đọc được.
function Read-Region($src, [double]$x, [double]$y, [double]$w, [double]$h, [double]$scale = 2, [double]$bin = 0, [string]$prefix = '') {
  $sx = $src.Width / 1920.0; $sy = $src.Height / 1080.0
  $rw = [int]($w * $sx); $rh = [int]($h * $sy)
  $pad = if ($bin -gt 0) { 24 } else { 0 }
  $dw = [int]($rw * $scale); $dh = [int]($rh * $scale)
  $px = if ($prefix -and $bin -gt 0) { [int]($dh * 0.5 * $prefix.Length + 40) } else { 0 }
  $bmp = New-Object System.Drawing.Bitmap ($dw + $px + 2 * $pad), ($dh + 2 * $pad)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $dst = New-Object System.Drawing.Rectangle ($pad + $px), $pad, $dw, $dh
  if ($bin -gt 0) {
    $g.Clear([System.Drawing.Color]::White)
    if ($px) {
      $font = New-Object System.Drawing.Font 'Arial', ([single]($dh * 0.5)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
      $g.DrawString($prefix, $font, [System.Drawing.Brushes]::Black, $pad, ($pad + $dh * 0.2)); $font.Dispose()
    }
    $ia = New-Object System.Drawing.Imaging.ImageAttributes
    $k = -1.0 / 3
    $cm = New-Object System.Drawing.Imaging.ColorMatrix (,[single[][]]@(
      [single[]]@($k, $k, $k, 0, 0), [single[]]@($k, $k, $k, 0, 0), [single[]]@($k, $k, $k, 0, 0),
      [single[]]@(0, 0, 0, 1, 0), [single[]]@(1, 1, 1, 0, 1)))
    $ia.SetColorMatrix($cm); $ia.SetThreshold([single](1 - $bin))
    $g.DrawImage($src, $dst, [int]($x * $sx), [int]($y * $sy), $rw, $rh, 'Pixel', $ia)
    $ia.Dispose()
  } else {
    $g.DrawImage($src, $dst, (New-Object System.Drawing.Rectangle ([int]($x * $sx)), ([int]($y * $sy)), $rw, $rh), 'Pixel')
  }
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
  $ras = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $out = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForWrite($ras); $ms.Position = 0; $ms.CopyTo($out); $out.Flush(); [void]$ras.Seek(0)
  $dec = Wait-Op ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $sb = Wait-Op ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $res = Wait-Op ($engine.RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])
  $ms.Dispose(); $out.Dispose(); $ras.Dispose(); $sb.Dispose()
  $txt = (($res.Lines | ForEach-Object { $_.Text }) -join ' | ').Trim()
  if ($Dump) { Write-Host ("  [{0},{1} {2}x{3} b{5}{6}] {4}" -f $x, $y, $w, $h, $txt, $bin, $prefix) }
  $txt
}
# Đọc số: đen trắng + chữ mồi "Gold" trước (đọc được cả số một chữ số), rồi ảnh gốc.
# Sửa chữ hay nhầm (o->0, s->5, l->1...). Vùng có chữ (tên người chơi) thì bỏ qua.
function Read-Number($src, [double]$x, [double]$y, [double]$w, [double]$h, [double]$scale = 3, [int]$max = 999) {
  foreach ($try in @(@(0.45, 'Gold'), @(0.6, 'Gold'), @(0, ''))) {
    $t = Read-Region $src $x $y $w $h $scale $try[0] $try[1]
    if ($try[1]) { $t = $t -replace '^\s*Gold\s*\|?\s*', '' }
    if ($t -match '[A-Za-z]{3,}') { continue }
    $t = $t -creplace '[oOD]', '0' -creplace '[sS]', '5' -creplace '[lI|!]', '1' -creplace 'B', '8' -creplace 'Z', '2'
    $t = $t -replace '[^\d]', ''
    if ($t -match '^\d{1,3}$' -and [int]$t -le $max) { return [int]$t }
  }
  $null
}

function Read-Screen($src) {
  $d = [ordered]@{}
  # Vòng: ô giữa trên cùng, vị trí lệch theo số biểu tượng nên đọc rộng.
  foreach ($b in 0, 0.45, 0.6) {
    $t = Read-Region $src 720 0 200 38 3 $b
    if ($t -match '([1-7])\s*[-–—~]\s*([1-7])') { $d.stage = "$($Matches[1])-$($Matches[2])"; break }
  }
  # Cấp + XP
  $t = Read-Region $src 340 880 200 32 3
  if ($t -match 'Lvl\.?\s*(\d{1,2})') { $v = [int]$Matches[1]; if ($v -ge 1 -and $v -le 10) { $d.level = $v } }
  if ($t -match '(\d{1,2})\s*/\s*(\d{1,2})') { $d.xp = @([int]$Matches[1], [int]$Matches[2]) }
  # Vàng: chỉ phần số bên phải đồng xu.
  $v = Read-Number $src 1018 882 56 34 3 999
  if ($null -ne $v) { $d.gold = $v }
  # Cửa hàng: 5 ô, đọc riêng từng ô để giữ thứ tự.
  $shop = @()
  foreach ($i in 0..4) {
    $n = Read-Region $src (552 + 202 * $i) 1045 150 30 2
    $n = ($n -replace '[|]', ' ' -replace '\s+', ' ').Trim()
    $shop += $(if ($n -match '[A-Za-z]{2,}') { $n } else { $null })
  }
  if (@($shop | Where-Object { $_ }).Count -ge 2) { $d.shop = $shop }
  # Tộc hệ: 8 dòng ở cột trái. Số đầu tiên = số tướng.
  $traits = @()
  foreach ($i in 0..7) {
    $c = 276 + 53.3 * $i
    $t = Read-Region $src 104 ($c - 18) 160 46 2
    $name = (($t -split '\|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '[A-Za-zÀ-ỹ]{2,}' } | Select-Object -First 1)
    if ($name) {
      $name = ($name -replace '^\W*\d*\s*', '' -replace '[^\p{L} /\.]', '').Trim()
      $num = if ($t -match '(\d+)') { [int]$Matches[1] } else { $null }
      if ($name.Length -ge 2) { $traits += [ordered]@{ n = $name; c = $num } }
    }
  }
  if ($traits.Count) { $d.traits = $traits }
  # Danh sách người chơi bên phải: 8 dòng. Dòng của bạn chỉ có số máu to, không có tên.
  $players = @()
  foreach ($i in 0..7) {
    $c = 203 + 80 * $i
    $name = ''
    foreach ($b in 0, 0.55) {
      $name = ((Read-Region $src 1690 ($c - 20) 128 40 2 $b) -replace '\|', ' ' -replace '\s+', ' ').Trim()
      if ($name -match '[A-Za-z]{3,}') { break }
    }
    if ($name -match '[A-Za-z]{3,}') {
      $players += [ordered]@{ name = $name; hp = (Read-Number $src 1820 ($c - 16) 42 32 3 100); self = $false }
    } else {
      # Dòng của bạn: số máu to nằm ở chỗ tên.
      $v = Read-Number $src 1690 ($c - 20) 128 40 2 100
      if ($null -ne $v -and $null -eq $d.hp) { $d.hp = $v; $players += [ordered]@{ name = ''; hp = $v; self = $true } }
    }
  }
  if ($players.Count -ge 3) { $d.players = $players }
  $d
}

function Get-GameBitmap {
  $h = [TftWin]::GetForegroundWindow()
  $procId = 0; [void][TftWin]::GetWindowThreadProcessId($h, [ref]$procId)
  try { $p = Get-Process -Id $procId -ErrorAction Stop } catch { return $null }
  if ($p.ProcessName -ne $Process) { return $null }
  $r = New-Object TftWin+RECT; [void][TftWin]::GetClientRect($h, [ref]$r)
  $pt = New-Object TftWin+POINT; [void][TftWin]::ClientToScreen($h, [ref]$pt)
  $w = $r.R - $r.L; $hh = $r.B - $r.T
  if ($w -lt 640 -or $hh -lt 360) { return $null }
  $bmp = New-Object System.Drawing.Bitmap $w, $hh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($pt.X, $pt.Y, 0, 0, $bmp.Size); $g.Dispose()
  $bmp
}

if ($Image) {
  $src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Image))
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $d = Read-Screen $src
  $src.Dispose()
  $d | ConvertTo-Json -Depth 5 -Compress
  Write-Host ("({0} ms)" -f $sw.ElapsedMilliseconds)
  exit 0
}

Write-Host 'TFT Helper - đang đọc màn hình. Mở web/index.html (bấm đúp). Đóng cửa sổ này để dừng.'
$last = ''; $waiting = $false
while ($true) {
  $bmp = $null
  try { $bmp = Get-GameBitmap } catch { $bmp = $null }
  if (-not $bmp) {
    if (-not $waiting) { Write-Host ("{0}  chờ cửa sổ TFT ở trên cùng..." -f (Get-Date -Format 'HH:mm:ss')); $waiting = $true }
  } else {
    $waiting = $false
    try {
      $d = Read-Screen $bmp
      $key = $d | ConvertTo-Json -Depth 5 -Compress
      if ($key -ne $last -and $d.Count) {
        $last = $key
        $d.seq = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        $d.at = Get-Date -Format 'HH:mm:ss'
        $json = $d | ConvertTo-Json -Depth 5 -Compress
        [IO.File]::WriteAllText($OutFile, "// Tự sinh bởi scripts/ocr-live.ps1. Không sửa tay.`nwindow.TFT_OCR = $json;`n", (New-Object Text.UTF8Encoding $false))
        Write-Host ("{0}  vòng {1} · cấp {2} · {3} vàng · {4} máu · shop: {5}" -f $d.at, $d.stage, $d.level, $d.gold, $d.hp, (($d.shop | ForEach-Object { if ($_) { $_ } else { '-' } }) -join ', '))
      }
    } catch { Write-Host ("Lỗi đọc: " + $_.Exception.Message) }
    $bmp.Dispose()
  }
  Start-Sleep -Milliseconds ([int]($Interval * 1000))
}

# Generates samples/two-voices.wav with Windows text-to-speech: two different voices taking turns.
param([string]$Out = "$PSScriptRoot\..\samples\two-voices.wav")
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
$a = $voices[0]; $b = if ($voices.Count -gt 1) { $voices[1] } else { $voices[0] }
$lines = @(
  @($a, "Good morning, and welcome to the weekly planning meeting. Today we need to decide on the launch date for the new mobile app."),
  @($b, "Thanks. I reviewed the test results yesterday. The crash rate dropped to under one percent, so I think we are nearly ready."),
  @($a, "That is great news. What about the translation work for the Spanish and French versions?"),
  @($b, "The Spanish strings are finished. French should be done by Thursday, assuming the agency delivers on time."),
  @($a, "Perfect. Then let's aim for a launch on the fifteenth of next month and review progress again on Friday.")
)
$p = New-Object System.Speech.Synthesis.PromptBuilder
foreach ($l in $lines) {
  $p.StartVoice($l[0]); $p.AppendText($l[1]); $p.AppendBreak([TimeSpan]::FromMilliseconds(700)); $p.EndVoice()
}
$s.SetOutputToWaveFile((Resolve-Path -LiteralPath (Split-Path $Out)).Path + "\" + (Split-Path $Out -Leaf))
$s.Speak($p); $s.Dispose()
Write-Output "voices: $a | $b"

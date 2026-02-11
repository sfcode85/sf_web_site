<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

/*
  ==============================================================
  Spirit of Fire — booking.php
  ==============================================================

  Ce fichier reçoit les formulaires du site et envoie un e-mail.

  Il gère 2 formulaires :
  - Demande de prestations (page demande-prestations)
  - Contact (page contact)

  IMPORTANT (à remplir selon ton hébergement) :
  1) Destinataire / expéditeur
    - Par défaut, on envoie à : asso.spirit.of.fire@gmail.com
    - Tu peux changer via variables d'environnement :
      SF_MAIL_TO=destinataire@domaine
      SF_MAIL_FROM=expediteur@domaine  (souvent la même adresse)
      SF_MAIL_FROM_NAME="Spirit of Fire"

  2) Envoi e-mail (recommandé)
    - Le plus fiable : SMTP (PHPMailer)
     -> installe PHPMailer via Composer dans SF/ :
       composer require phpmailer/phpmailer
     -> puis configure :
       SF_SMTP_HOST, SF_SMTP_PORT (ex 587), SF_SMTP_USER, SF_SMTP_PASS
       SF_SMTP_SECURE=tls (ou ssl / none)

    - Sinon, fallback : mail() PHP
     -> fonctionne seulement si ton serveur a un MTA configuré (sendmail/postfix).
*/

function respond(int $statusCode, array $payload): void {
  http_response_code($statusCode);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  respond(405, ['ok' => false, 'error' => 'Méthode non autorisée.']);
}

// Optional Composer autoload (for PHPMailer)
$autoload = __DIR__ . '/vendor/autoload.php';
if (is_file($autoload)) {
  require_once $autoload;
}

// Basic input helper
function post_str(string $key, int $maxLen = 2000): string {
  $value = $_POST[$key] ?? '';
  if (!is_string($value)) {
    return '';
  }
  $value = trim($value);
  // Prevent header injection
  $value = str_replace(["\r", "\n"], ' ', $value);
  if (function_exists('mb_substr')) {
    return mb_substr($value, 0, $maxLen);
  }
  return substr($value, 0, $maxLen);
}

// Text helper (keeps newlines for message bodies)
function post_text(string $key, int $maxLen = 6000): string {
  $value = $_POST[$key] ?? '';
  if (!is_string($value)) {
    return '';
  }
  $value = trim(str_replace(["\r\n", "\r"], "\n", $value));
  // Basic hardening
  $value = str_replace(["\0"], '', $value);
  if (function_exists('mb_substr')) {
    return mb_substr($value, 0, $maxLen);
  }
  return substr($value, 0, $maxLen);
}

// --- Contact fields ---
$contactName = post_str('name', 140);
$contactEmail = post_str('email', 200);
$contactMessage = post_text('message', 6000);

// --- Prestations fields ---
$nom = post_str('nom', 120);
$prenom = post_str('prenom', 120);
$organisation = post_str('organisation', 200);
$email = post_str('email', 200);
$telephone = post_str('telephone', 80);
$date = post_str('date', 40);
$lieu = post_str('lieu', 200);
$details = post_text('details', 6000);

$isContact = ($contactMessage !== '');

if ($isContact) {
  if ($contactEmail === '' || !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['ok' => false, 'error' => "Adresse e-mail invalide."]);
  }
  if ($contactMessage === '') {
    respond(400, ['ok' => false, 'error' => "Merci d'écrire un message."]);
  }
} else {
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['ok' => false, 'error' => "Adresse e-mail invalide."]);
  }

  if ($telephone === '' || $date === '' || $lieu === '') {
    respond(400, ['ok' => false, 'error' => "Merci de remplir les champs obligatoires."]);
  }
}

function env_str(string $key, string $default = ''): string {
  $value = getenv($key);
  if ($value === false) {
    return $default;
  }
  $value = trim((string)$value);
  return $value !== '' ? $value : $default;
}

$to = env_str('SF_MAIL_TO', 'asso.spirit.of.fire@gmail.com');
$from = env_str('SF_MAIL_FROM', $to);
$fromName = env_str('SF_MAIL_FROM_NAME', 'Spirit of Fire');

// Optionnel : un destinataire différent pour le contact (sinon SF_MAIL_TO)
$contactTo = env_str('SF_CONTACT_MAIL_TO', $to);

$displayName = trim(($prenom !== '' ? ($prenom . ' ') : '') . $nom);

if ($isContact) {
  $subjectRaw = 'Contact - Spirit of Fire';
  if ($contactName !== '') {
    $subjectRaw .= ' - ' . $contactName;
  }
} else {
  $subjectRaw = 'Demande de prestations - Spirit of Fire';
  if ($displayName !== '') {
    $subjectRaw .= ' - ' . $displayName;
  }
  if ($date !== '') {
    $subjectRaw .= ' (' . $date . ')';
  }
}

// Encode subject for UTF-8
$subject = function_exists('mb_encode_mimeheader')
  ? mb_encode_mimeheader($subjectRaw, 'UTF-8')
  : $subjectRaw;

$lines = [];
if ($isContact) {
  $lines[] = "Nouveau message de contact (Spirit of Fire)";
  $lines[] = "";
  $lines[] = "Nom: " . ($contactName !== '' ? $contactName : '-');
  $lines[] = "Email: " . $contactEmail;
  $lines[] = "";
  $lines[] = "Message:";
  $lines[] = ($contactMessage !== '' ? $contactMessage : '-');
} else {
  $lines[] = "Nouvelle demande de prestations (Spirit of Fire)";
  $lines[] = "";
  $lines[] = "Nom: " . ($nom !== '' ? $nom : '-');
  $lines[] = "Prénom: " . ($prenom !== '' ? $prenom : '-');
  $lines[] = "Organisation: " . ($organisation !== '' ? $organisation : '-');
  $lines[] = "Email: " . $email;
  $lines[] = "Téléphone: " . $telephone;
  $lines[] = "Date: " . $date;
  $lines[] = "Lieu: " . $lieu;
  $lines[] = "";
  $lines[] = "Détails:";
  $lines[] = ($details !== '' ? $details : '-');
}
$body = implode("\n", $lines);

// Preferred for real hosting: SMTP (PHPMailer) if configured.
$smtpHost = env_str('SF_SMTP_HOST');
$smtpUser = env_str('SF_SMTP_USER');
$smtpPass = env_str('SF_SMTP_PASS');
$smtpPort = (int)env_str('SF_SMTP_PORT', '587');
$smtpSecure = strtolower(env_str('SF_SMTP_SECURE', 'tls')); // tls|ssl|none

$sent = false;

if ($smtpHost !== '' && class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
  try {
    $mailer = new PHPMailer\PHPMailer\PHPMailer(true);
    $mailer->CharSet = 'UTF-8';
    $mailer->isSMTP();
    $mailer->Host = $smtpHost;
    $mailer->Port = $smtpPort > 0 ? $smtpPort : 587;

    if ($smtpSecure === 'ssl') {
      $mailer->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    } elseif ($smtpSecure === 'none') {
      $mailer->SMTPSecure = false;
      $mailer->SMTPAutoTLS = false;
    } else {
      $mailer->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    }

    if ($smtpUser !== '') {
      $mailer->SMTPAuth = true;
      $mailer->Username = $smtpUser;
      $mailer->Password = $smtpPass;
    } else {
      $mailer->SMTPAuth = false;
    }

    $mailer->setFrom($from, $fromName);
    $mailer->addAddress($isContact ? $contactTo : $to);
    $replyEmail = $isContact ? $contactEmail : $email;
    $replyName = $isContact ? ($contactName !== '' ? $contactName : $contactEmail) : ($displayName !== '' ? $displayName : $email);
    $mailer->addReplyTo($replyEmail, $replyName);
    $mailer->Subject = $subjectRaw;
    $mailer->Body = $body;
    $mailer->isHTML(false);

    $sent = $mailer->send();
  } catch (Throwable $e) {
    $sent = false;
  }
}

// Fallback: PHP mail() (requires sendmail/postfix on server)
if (!$sent) {
  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-Type: text/plain; charset=UTF-8';
  $headers[] = 'From: ' . $fromName . ' <' . $from . '>';
  $headers[] = 'Reply-To: ' . ($isContact ? $contactEmail : $email);
  $headers[] = 'X-Mailer: PHP/' . phpversion();

  $sent = @mail($isContact ? $contactTo : $to, $subject, $body, implode("\r\n", $headers));
}

if (!$sent) {
  respond(500, ['ok' => false, 'error' => "Impossible d'envoyer l'e-mail (configuration serveur)."]);
}

respond(200, ['ok' => true]);

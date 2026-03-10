export default function PrivacyPolicy() {
  return (
    <div style={{
      maxWidth: '720px',
      margin: '0 auto',
      padding: '2rem 1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e0e0e0',
      backgroundColor: '#0a0a1a',
      minHeight: '100vh',
      lineHeight: 1.7,
    }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#00e5ff' }}>
        Privacy Policy
      </h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Last updated: March 9, 2026
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Overview</h2>
      <p>
        Impact (&quot;the Game&quot;) is an idle clicker game developed by an independent developer.
        We are committed to protecting your privacy. This policy explains what data the Game
        collects, how it is used, and your rights.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Data We Collect</h2>
      <p>
        <strong>Game Progress:</strong> Your game save data (progress, settings, and preferences)
        is stored locally on your device using browser local storage. This data never leaves
        your device and is not transmitted to any server.
      </p>
      <p>
        <strong>Advertising:</strong> The Game displays ads through Google AdMob. Google AdMob
        may collect certain data as described in{' '}
        <a href="https://policies.google.com/privacy" style={{ color: '#00e5ff' }}>
          Google&apos;s Privacy Policy
        </a>. This may include device identifiers, IP address, and ad interaction data.
        This data is collected and processed by Google, not by us.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Data We Do NOT Collect</h2>
      <p>
        We do not collect, store, or transmit any personal information, including but not
        limited to: names, email addresses, phone numbers, location data, contacts, photos,
        or any other personally identifiable information. We do not have any servers or
        databases that store user data.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Third-Party Services</h2>
      <p>
        The Game uses Google AdMob for advertising. Google AdMob is operated by Google LLC
        and is subject to Google&apos;s privacy policy. You can learn more about how Google uses
        data at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" style={{ color: '#00e5ff' }}>
          https://policies.google.com/technologies/partner-sites
        </a>.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Children&apos;s Privacy</h2>
      <p>
        The Game is not directed at children under 13. We do not knowingly collect any
        personal information from children. The Game does not require account creation
        or any personal data to play.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Your Rights</h2>
      <p>
        Since all game data is stored locally on your device, you have full control over it.
        You can delete your game data at any time by using the &quot;Hard Reset&quot; option in the
        game&apos;s settings, or by clearing the app&apos;s data through your device settings.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Changes to This Policy</h2>
      <p>
        We may update this privacy policy from time to time. Any changes will be reflected
        on this page with an updated date.
      </p>

      <h2 style={{ fontSize: '1.2rem', color: '#00e5ff', marginTop: '1.5rem' }}>Contact</h2>
      <p>
        If you have any questions about this privacy policy, you can contact us at:{' '}
        <a href="mailto:chrishardin.als@gmail.com" style={{ color: '#00e5ff' }}>
          chrishardin.als@gmail.com
        </a>
      </p>

      <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #333', textAlign: 'center' }}>
        <a href="/" style={{ color: '#00e5ff', fontSize: '0.9rem' }}>
          Back to Game
        </a>
      </div>
    </div>
  );
}

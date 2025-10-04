const DISCORD_WEBHOOK_URL = import.meta.env.VITE_DISCORD_WEBHOOK_URL as string;

export async function sendToDiscord(formData: {
  email: string;
  walletAddress: string;
  username: string;
  discordUsername?: string;
  referralCode?: string;
  subscribeNewsletter?: boolean;
}) {
  try {
    const embed = {
      title: "🔥 New Sol Royale Registration!",
      color: 0xff5e00,
      fields: [
        {
          name: "📧 Email",
          value: formData.email,
          inline: true,
        },
        {
          name: "💰 Wallet Address",
          value: formData.walletAddress
            ? formData.walletAddress
            : "Not provided",
          inline: true,
        },
        {
          name: "⚔️ Battle Username",
          value: formData.username,
          inline: true,
        },
        {
          name: "💬 Discord",
          value: formData.discordUsername || "Not provided",
          inline: true,
        },
        {
          name: "🎁 Referral Code",
          value: formData.referralCode || "None",
          inline: true,
        },
        {
          name: "📰 Newsletter",
          value: formData.subscribeNewsletter ? "✅ Yes" : "❌ No",
          inline: true,
        },
      ],
      footer: {
        text: `Registration Time: ${new Date().toLocaleString()}`,
      },
    };

    const payload = {
      embeds: [embed],
      username: "Sol Royale Bot",
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook error: ${response.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error sending to Discord:", error);
    return { success: false, error: error.message };
  }
}
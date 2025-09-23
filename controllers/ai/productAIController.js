import axios from 'axios';

// This is your AI controller for generating product descriptions
export const generateProductDescription = async (req, res) => {
  try {
    const { name, category, features } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Product name and category are required.' });
    }

    // Construct the prompt for the AI
    const prompt = `
      Write an engaging product description for an artisan product.
      Product Name: ${name}
      Category: ${category}
      Key Features: ${features || 'Handmade, traditional, high-quality'}
      Tone: friendly, story-telling, appealing to modern buyers.
    `;

    // Call the AI API (Vertex AI / Gemini)
    const response = await axios.post(
      'https://YOUR_VERTEX_AI_ENDPOINT', // Replace with actual Vertex/Gemini endpoint
      {
        prompt: prompt,
        max_tokens: 150, // Adjust length as needed
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERTEX_AI_KEY}`, // Your API key
          'Content-Type': 'application/json',
        },
      }
    );

    const generatedText = response.data.text || response.data.output?.[0]?.content; // Adjust based on API response

    res.status(200).json({ description: generatedText });
  } catch (error) {
    console.error('AI generation error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate description.' });
  }
};

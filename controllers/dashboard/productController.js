const formidable = require('formidable');
const cloudinary = require('cloudinary').v2;
const productModel = require('../../models/productModel');
const { responseReturn } = require('../../utiles/response');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const reviewModel = require('../../models/reviewModel');
const customerOrderModel = require('../../models/customerOrder');

class productController {

    add_product = async (req, res) => {
        const { id } = req; // seller ID
        const form = formidable({ multiples: true });

        console.log("Parsing incoming product form...");

        form.parse(req, async (err, field, files) => {
            if (err) {
                console.log("Formidable parsing error:", err);
                return responseReturn(res, 500, { error: err.message });
            }

            console.log("Received fields:", field);
            console.log("Received files:", files);

            try {
                let { name, category, description, stock, price, discount, shopName, brand } = field;
                let { images } = files;
                if (!Array.isArray(images)) images = [images]; // ensure array

                if (!name || !category || !stock || !price || !shopName || !brand) {
                    console.log("⚠️ Missing required fields");
                }

                // Clean up name
                name = name.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
                const slug = name.split(' ').join('-');
                console.log("Cleaned name:", name, "Slug:", slug);

                // === Cloudinary image upload ===
                cloudinary.config({
                    cloud_name: process.env.cloud_name,
                    api_key: process.env.api_key,
                    api_secret: process.env.api_secret,
                    secure: true
                });

                const allImageUrl = [];
                if (images && images.length > 0) {
                    console.log("Uploading images to Cloudinary...");
                    for (let img of images) {
                        console.log("Uploading image:", img.filepath);
                        const result = await cloudinary.uploader.upload(img.filepath, { folder: 'products' });
                        allImageUrl.push(result.secure_url);
                    }
                }

                // === Gemini AI description generator with image analyzer ===
                async function generateAIResponse(messages, localFilePaths = []) {
                    const formatted = messages.map((m) => ({
                        role: m.role,
                        parts: [{ text: m.content }]
                    }));

                    // Add image analysis if files exist
                    for (let path of localFilePaths) {
                        try {
                            const buffer = await fs.readFile(path);
                            const base64Data = buffer.toString("base64");

                            formatted.push({
                                role: "user",
                                parts: [
                                    { text: "Analyze this product image for materials, colors, textures, style, patterns, craftsmanship, and unique design elements. Describe it vividly for buyers." },
                                    { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                                ]
                            });
                        } catch (e) {
                            console.error("⚠️ Could not read file for Gemini:", path, e.message);
                        }
                    }

                    try {
                        const apiKey = process.env.GEMINI_API_KEY;
                        const genAI = new GoogleGenerativeAI(apiKey);
                        const model = genAI.getGenerativeModel({
                            model: "gemini-2.5-flash",
                            systemInstruction: {
                                role: `You are a professional eCommerce copywriter. 
                                Your job is to create irresistible, highly descriptive, 
                                and emotionally appealing product descriptions 
                                that highlight materials, textures, colors, style, uniqueness, 
                                and cultural/artisan value. 
                                Always write in a storytelling + marketing tone, 
                                naturally include SEO-friendly keywords, 
                                and finish with a short persuasive call to action.`
                            },
                            generationConfig: {
                                temperature: 0.7,
                                topK: 40,
                                topP: 0.9
                            },
                        });

                        const res = await model.generateContent({ contents: formatted });
                        const parts = res?.response?.candidates?.[0]?.content?.parts || [];
                        const answer = parts.map((p) => p.text).join("\n\n").trim();
                        return answer || "No polished description returned";
                    } catch (err) {
                        console.error("❌ Gemini API error:", err.message);
                        return "⚠️ AI description unavailable";
                    }
                }

                // ✨ Polished prompt for Gemini
                const promptMessage = [
                    {
                        role: "user",
                        content: `
You are given details of a handcrafted or artisan product. 
Write the **best possible marketing-ready description** that blends storytelling, luxury retail style, and emotional appeal.

Include:
- Key product features (materials, textures, design details, functionality).
- How it looks & feels (style, vibe, cultural or artisan value).
- Subtle brand story (authenticity, craftsmanship, uniqueness).
- SEO-friendly keywords naturally woven in.
- A warm, persuasive call-to-action.

Original Seller Description: ${description || 'No description provided.'}
Product Name: ${name}
Category: ${category}
Brand: ${brand}
Original Price: Rs ${price}
Discount: ${discount} %
Shop Name: ${shopName}
                        `
                    }
                ];

                // ✅ Use local filepaths (from Formidable) for Gemini analysis
                const localPaths = images.map((img) => img.filepath);
                description = await generateAIResponse(promptMessage, localPaths);

                console.log("✅ AI-polished + image-enhanced description:", description);

                // === Create product in DB ===
                const product = await productModel.create({
                    sellerId: id,
                    name,
                    slug,
                    shopName,
                    category: category.trim(),
                    description: description.trim(),
                    stock: parseInt(stock),
                    price: parseInt(price),
                    discount: parseInt(discount),
                    images: allImageUrl,
                    brand: brand.trim()
                });

                console.log("🎉 Product created successfully:", product);
                responseReturn(res, 201, { message: "Product added successfully with AI-powered premium description" });

            } catch (error) {
                console.log("❌ Error in add_product controller:", error);
                responseReturn(res, 500, { error: error.message });
            }
        });
    }

    product_delete = async (req, res) => {
        const { productId } = req.params;

        try {
            const product = await productModel.findById(productId);
            if (!product) return res.status(404).json({ message: 'Product not found' });

            // Configure Cloudinary
            cloudinary.config({
                cloud_name: process.env.cloud_name,
                api_key: process.env.api_key,
                api_secret: process.env.api_secret,
                secure: true
            });

            // Delete all images from Cloudinary
            for (let imageUrl of product.images) {
                // Extract public_id from URL
                const segments = imageUrl.split('/');
                const fileName = segments[segments.length - 1].split('.')[0]; // remove extension
                await cloudinary.uploader.destroy(`products/${fileName}`);
            }

            // Delete product from DB
            await productModel.findByIdAndDelete(productId);

            res.status(200).json({ message: 'Product deleted successfully' });
        } catch (error) {
            console.log("Error deleting product:", error.message);
            res.status(500).json({ error: error.message });
        }
    };



    products_get = async (req, res) => {
        const { page, searchValue, parPage } = req.query;
        const { id } = req;

        const skipPage = parseInt(parPage) * (parseInt(page) - 1);

        try {
            let products, totalProduct;

            if (searchValue) {
                products = await productModel.find({
                    $text: { $search: searchValue },
                    sellerId: id
                })
                    .skip(skipPage)
                    .limit(parPage)
                    .sort({ createdAt: -1 });

                totalProduct = await productModel.find({
                    $text: { $search: searchValue },
                    sellerId: id
                }).countDocuments();
            } else {
                products = await productModel.find({ sellerId: id })
                    .skip(skipPage)
                    .limit(parPage)
                    .sort({ createdAt: -1 });

                totalProduct = await productModel.find({ sellerId: id }).countDocuments();
            }

            // === Fetch reviews related to the products ===
            const productIds = products.map(p => p._id);
            const reviews = await reviewModel.find({ productId: { $in: productIds } });

            const productWithReviews = products.map(p => ({
                ...p.toObject(),
                reviews: reviews.filter(r => r.productId.toString() === p._id.toString())
            }));

            // === Gemini AI Insights Generator ===
            async function generateInsights(data) {
                try {
                    const apiKey = process.env.GEMINI_API_KEY;
                    const genAI = new GoogleGenerativeAI(apiKey);

                    const model = genAI.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        systemInstruction: {
                            role: `You are a product insights analyst for an e-commerce platform. 
                        Your job is to analyze product details and reviews, 
                        then return structured insights for the seller.`,
                        },
                        generationConfig: {
                            temperature: 0.6,
                            topK: 30,
                            topP: 0.9
                        },
                    });

                    const prompt = `
You are given a dataset of products with customer reviews. 
Analyze them and provide:

1. Common customer sentiments (positive & negative).
2. Key strengths of the products (quality, price, uniqueness).
3. Weaknesses or common complaints.
4. Suggestions for product improvement.
5. A short motivational summary for the seller.

Data: ${JSON.stringify(data, null, 2)}
                `;

                    const result = await model.generateContent(prompt);
                    return result.response.text();
                } catch (err) {
                    console.error("❌ Gemini Insights API error:", err.message);
                    return "⚠️ AI insights unavailable";
                }
            }

            // ✅ Generate insights based on products + reviews
            const insights = await generateInsights(productWithReviews);

            // === Final Response ===
            responseReturn(res, 200, {
                totalProduct,
                products,    // unchanged
                insights     // extra Gemini-powered insights
            });

        } catch (error) {
            console.log("❌ Error in products_get:", error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }



    product_get = async (req, res) => {
        const { productId } = req.params
        console.log("🔍 Fetching product with ID:", productId)

        try {
            // 1️⃣ Fetch the product
            const product = await productModel.findById(productId)
            if (!product) {
                console.log("⚠️ Product not found")
                return responseReturn(res, 404, { error: "Product not found" })
            }
            console.log("✅ Product fetched:", product.name)

            // 2️⃣ Fetch reviews for this product
            const reviews = await reviewModel.find({ productId })
            console.log(`📄 Found ${reviews.length} reviews for this product`)

            // 3️⃣ Fetch customer orders containing this product
            const orders = await customerOrderModel.find({ "products._id": productId })
            const orderSummary = orders.map(order => {
                const productInOrder = order.products.find(p => p._id.toString() === productId.toString());
                return {
                    quantity: productInOrder.quantity,
                    price: productInOrder.price,
                    payment_status: productInOrder.payment_status || 'unknown',
                    location: order.shippingInfo?.city || order.shippingInfo?.province || 'Unknown',
                    delivery_status: order.shippingInfo?.delivery_status || 'pending',
                    orderDate: order.createdAt
                };
            });
            console.log(`🛒 Found ${orders.length} orders containing this product`)
            console.log("📍 Sample order locations:", orderSummary.slice(0, 5))

            // 4️⃣ Prepare data for AI insights
            const dataForAI = {
                product: product.toObject(),
                reviews,
                orders: orderSummary
            }
            console.log("🤖 Preparing data for Gemini AI...")

            // 5️⃣ Generate AI insights
            async function generateInsights(data) {
                try {
                    console.log("⏳ Generating AI insights...")
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
                    const model = genAI.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        systemInstruction: {
                            role: `You are an e-commerce product analyst. Analyze product details, reviews, 
and order locations. Provide structured, personalized insights and improvement suggestions. 
Consider regional preferences, demography, and traditions.`
                        },
                        generationConfig: { temperature: 0.6, topK: 30, topP: 0.9 }
                    })

                    const prompt = `
Product with reviews and order info:
${JSON.stringify(data, null, 2)}

Provide:
1. Common customer sentiments (positive & negative)
2. Product strengths
3. Weaknesses or complaints
4. Personalized improvement suggestions based on location, region, and demography
5. Motivational summary for the seller
                `
                    const result = await model.generateContent(prompt)
                    console.log("✅ AI insights generated successfully")
                    return result.response.text()
                } catch (err) {
                    console.error("❌ Gemini AI error:", err.message)
                    return "⚠️ AI insights unavailable"
                }
            }

            const insights = await generateInsights(dataForAI)
            console.log("📖 Insights preview:", insights.slice(0, 300), "...")

            // 6️⃣ Send the final response
            responseReturn(res, 200, {
                product,
                reviews,
                orders: orderSummary,
                insights
            })
            console.log("🚀 Response sent successfully!")

        } catch (error) {
            console.error("❌ product_get error:", error.message)
            responseReturn(res, 500, { error: error.message })
        }
    }


    product_update = async (req, res) => {
        let { name, description, discount, price, brand, productId, stock } = req.body;
        name = name.trim()
        name = name.replace(/[^a-zA-Z0-9\s-]/g, '')
        const slug = name.split(' ').join('-')

        try {
            await productModel.findByIdAndUpdate(productId, {
                name, description, discount, price, brand, productId, stock, slug
            })
            const product = await productModel.findById(productId)
            responseReturn(res, 200, { product, message: 'product update success' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }
    product_image_update = async (req, res) => {
        const form = formidable({ multiples: true })

        form.parse(req, async (err, field, files) => {
            const { productId, oldImage } = field;
            const { newImage } = files

            if (err) {
                responseReturn(res, 404, { error: err.message })
            } else {
                try {
                    cloudinary.config({
                        cloud_name: process.env.cloud_name,
                        api_key: process.env.api_key,
                        api_secret: process.env.api_secret,
                        secure: true
                    })
                    const result = await cloudinary.uploader.upload(newImage.filepath, { folder: 'products' })

                    if (result) {
                        let { images } = await productModel.findById(productId)
                        const index = images.findIndex(img => img === oldImage)
                        images[index] = result.url;

                        await productModel.findByIdAndUpdate(productId, {
                            images
                        })

                        const product = await productModel.findById(productId)
                        responseReturn(res, 200, { product, message: 'product image update success' })
                    } else {
                        responseReturn(res, 404, { error: 'image upload failed' })
                    }
                } catch (error) {
                    responseReturn(res, 404, { error: error.message })
                }
            }
        })
    }
}

module.exports = new productController()
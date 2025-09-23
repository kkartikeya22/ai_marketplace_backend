const sellerModel = require('../../models/sellerModel')
const { responseReturn } = require('../../utiles/response')

class sellerController {

    get_seller_request = async (req, res) => {
        const { page, searchValue, parPage } = req.query
        const skipPage = parseInt(parPage) * (parseInt(page) - 1)
        try {
            if (searchValue) {
                //const seller
            } else {
                const sellers = await sellerModel.find({ status: 'pending' }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalSeller = await sellerModel.find({ status: 'pending' }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            }
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }
    update_seller_profile = async (req, res) => {
        const { sellerId } = req.params;
        const { name, email, phone, address, shopName, division, district, sub_district, avatar } = req.body;

        console.log("🔄 Updating seller profile for ID:", sellerId);
        console.log("📥 Incoming body:", req.body);

        try {
            const updateData = {};

            if (name) updateData.name = name;
            if (email) updateData.email = email;
            if (avatar) updateData.image = avatar; // matches schema

            // put shop-related info inside shopInfo object
            updateData.shopInfo = {
                phone: phone || "",
                address: address || "",
                shopName: shopName || "",
                division: division || "",
                district: district || "",
                sub_district: sub_district || ""
            };

            console.log("🛠 Final updateData:", updateData);

            const updatedSeller = await sellerModel.findByIdAndUpdate(
                sellerId,
                updateData,
                { new: true } // returns updated doc
            );

            if (!updatedSeller) {
                console.log("❌ Seller not found for ID:", sellerId);
                return responseReturn(res, 404, { message: 'Seller not found' });
            }

            console.log("✅ Updated Seller in DB:", updatedSeller);

            responseReturn(res, 200, {
                seller: updatedSeller,
                message: 'Seller profile updated successfully'
            });

        } catch (error) {
            console.error("🔥 Error updating seller profile:", error.message);
            responseReturn(res, 500, { error: error.message });
        }
    };




    get_seller = async (req, res) => {
        const { sellerId } = req.params

        try {
            const seller = await sellerModel.findById(sellerId)
            responseReturn(res, 200, { seller })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    seller_status_update = async (req, res) => {
        const { sellerId, status } = req.body
        try {
            await sellerModel.findByIdAndUpdate(sellerId, {
                status
            })
            const seller = await sellerModel.findById(sellerId)
            responseReturn(res, 200, { seller, message: 'seller status update success' })
        } catch (error) {
            responseReturn(res, 500, { error: error.message })
        }
    }

    get_active_sellers = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)

        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                const sellers = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'active'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalSeller = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'active'
                }).countDocuments()

                responseReturn(res, 200, { totalSeller, sellers })
            } else {
                const sellers = await sellerModel.find({ status: 'active' }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalSeller = await sellerModel.find({ status: 'active' }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            }

        } catch (error) {
            console.log('active seller get ' + error.message)
        }
    }

    get_deactive_sellers = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)

        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                const sellers = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'deactive'
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalSeller = await sellerModel.find({
                    $text: { $search: searchValue },
                    status: 'deactive'
                }).countDocuments()

                responseReturn(res, 200, { totalSeller, sellers })
            } else {
                const sellers = await sellerModel.find({ status: 'deactive' }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalSeller = await sellerModel.find({ status: 'deactive' }).countDocuments()
                responseReturn(res, 200, { totalSeller, sellers })
            }

        } catch (error) {
            console.log('active seller get ' + error.message)
        }
    }
}

module.exports = new sellerController()
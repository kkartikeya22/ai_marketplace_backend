const categoryModel = require('../../models/categoryModel')
const { responseReturn } = require('../../utiles/response')
const cloudinary = require('cloudinary').v2
const formidable = require('formidable')

class categoryController {

    add_category = async (req, res) => {
        const form = formidable()
        form.parse(req, async (err, fields, files) => {
            if (err) {
                responseReturn(res, 404, { error: 'something error' })
            } else {
                let { name } = fields
                let { image } = files
                name = name.trim()
                const slug = name.split(' ').join('-')

                cloudinary.config({
                    cloud_name: process.env.cloud_name,
                    api_key: process.env.api_key,
                    api_secret: process.env.api_secret,
                    secure: true
                })

                try {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'categorys' })

                    if (result) {
                        const category = await categoryModel.create({
                            name,
                            slug,
                            image: result.url
                        })
                        responseReturn(res, 201, { category, message: 'category add success' })
                    } else {
                        responseReturn(res, 404, { error: 'Image upload failed' })
                    }
                } catch (error) {
                    responseReturn(res, 500, { error: 'Internal server error' })
                }

            }
        })
    }

    get_category = async (req, res) => {
        const { page, searchValue, parPage } = req.query
        try {
            let skipPage = ''
            if (parPage && page) {
                skipPage = parseInt(parPage) * (parseInt(page) - 1)
            }
            if (searchValue && page && parPage) {
                const categorys = await categoryModel.find({
                    $text: { $search: searchValue }
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalCategory = await categoryModel.find({
                    $text: { $search: searchValue }
                }).countDocuments()
                responseReturn(res, 200, { totalCategory, categorys })
            }
            else if (searchValue === '' && page && parPage) {
                const categorys = await categoryModel.find({}).skip(skipPage).limit(parPage).sort({ createdAt: -1 })
                const totalCategory = await categoryModel.find({}).countDocuments()
                responseReturn(res, 200, { totalCategory, categorys })
            }
            else {
                const categorys = await categoryModel.find({}).sort({ createdAt: -1 })
                const totalCategory = await categoryModel.find({}).countDocuments()
                responseReturn(res, 200, { totalCategory, categorys })
            }
        } catch (error) {
            console.log(error.message)
        }
    }

    update_category = async (req, res) => {
        const form = formidable()
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 404, { error: 'Something went wrong' })

            const { id, name } = fields
            let updateData = { slug: name.split(' ').join('-') }
            if (name) updateData.name = name

            if (files.image) {
                cloudinary.config({
                    cloud_name: process.env.cloud_name,
                    api_key: process.env.api_key,
                    api_secret: process.env.api_secret,
                    secure: true
                })
                try {
                    const result = await cloudinary.uploader.upload(files.image.filepath, { folder: 'categorys' })
                    updateData.image = result.url
                } catch (error) {
                    return responseReturn(res, 500, { error: 'Image upload failed' })
                }
            }

            try {
                const updatedCategory = await categoryModel.findByIdAndUpdate(id, updateData, { new: true })
                if (!updatedCategory) return responseReturn(res, 404, { error: 'Category not found' })
                responseReturn(res, 200, { category: updatedCategory, message: 'Category updated successfully' })
            } catch (error) {
                responseReturn(res, 500, { error: 'Internal server error' })
            }
        })
    }

    // Delete Category
    delete_category = async (req, res) => {
        const { id } = req.params
        try {
            const deletedCategory = await categoryModel.findByIdAndDelete(id)
            if (!deletedCategory) return responseReturn(res, 404, { error: 'Category not found' })
            responseReturn(res, 200, { message: 'Category deleted successfully' })
        } catch (error) {
            responseReturn(res, 500, { error: 'Internal server error' })
        }
    }
}

module.exports = new categoryController()
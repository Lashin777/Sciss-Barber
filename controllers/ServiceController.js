import {addService,
        getAllServices,
        getServiceById,
        updateService,
        deleteService,
        getServicesByCategory,
        getAllServicesForAdmin,
        getAllServiceCategories
} from '../services/ServiceService.js';

const getAllServicesController = async(req,res)=>{
    try{
        const services = await getAllServices();

        return res.status(200).json({
            success:true,
            services
        });
        
    }catch(error){
        return res.status(500).json({
            success:false,
            message:error.message
        });
    }
}


const addServiceController = async (req, res) => {
    try {
        const newService = await addService(req.body);
        return res.status(201).json({
            success:true,
            service:newService
        });
        
    } catch (error) {
        return res.status(400).json({
            success:false,
            message:error.message
        })   
    }
};

const getServiceByIdController = async (req, res) => {
    try {
        const service = await getServiceById(req.params.id);

        return res.status(200).json({
            success: true,
            service
        });

    } catch (error) {
        return res.status(404).json({
            success: false,
            message: error.message
        });
    }
};

const updateServiceController = async(req,res)=>{
    try{
        const updatedservice = await updateService(req.params.id,req.body);

        return res.status(200).json({
            success:true,
            service:updatedservice
        });
    }catch(error){
        return res.status(400).json({
            success:false,
            message:error.message
        })
    }
}

const deleteServiceController = async(req,res)=>{
    try{
        const service = await deleteService(req.params.id);
        
        return res.status(200).json({
            success:true,
            message:"Service deactivated Succesfully",
            service
            
        });
    }catch(error){
        return res.status(400).json({
            success:false,
            message:error.message
        })
    }
}

const getServicesByCategoryController = async (req, res) => {
    try {
        const services = await getServicesByCategory(req.params.categoryId);

        return res.status(200).json({
            success: true,
            services
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getAdminServicesPageController = async (req, res) => {
    const requestedLimit = Number(req.query.limit);
    const limit = [10, 25, 50].includes(requestedLimit) ? requestedLimit : 10;
    const requestedPage = Number(req.query.page);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const categoryParam = typeof req.query.category === 'string' ? req.query.category : '';
    const category = /^[a-f\d]{24}$/i.test(categoryParam) ? categoryParam : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

    try {
        const { services, totalServices, page: currentPage } = await getAllServicesForAdmin(page, limit, {
            categoryId: category,
            search
        });
        const categories = await getAllServiceCategories();
        const totalpages = Math.ceil(totalServices / limit);

        return res.render('admin/services', {
            services,
            categories,
            page: currentPage,
            limit,
            category,
            search,
            totalpages,
            servicePageError: null
        });
    } catch (error) {
        return res.status(500).render('admin/services', {
            services: [],
            categories: [],
            page: 1,
            limit,
            category,
            search,
            totalpages: 0,
            servicePageError: error.message
        });
    }
};
export {getAllServicesController,
        addServiceController,
        getServiceByIdController,
        updateServiceController,
        deleteServiceController,
        getServicesByCategoryController,
        getAdminServicesPageController}


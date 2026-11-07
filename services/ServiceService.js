import Service from '../models/Service.js';
import ServiceCategory from '../models/ServiceCategory.js';



const addService = async (serviceData) => {
    try{
        const { name,categoryId,description,price,duration} = serviceData;
        const category = await ServiceCategory.findById(categoryId);

        if(!category){
            throw new Error("category not Found");
        }
        const newService = await Service.create(serviceData)
        return newService
    }catch(error){
        throw(error)
    }
};

const getAllServices = async () => {
    const services = await Service.find({isActive:true});
    return services;
};

const getServiceById = async (serviceId) => {
    const service = await Service.findById(serviceId);

    if (!service) {
        throw new Error("Service not found");
    }

    return service;
};

const updateService = async(serviceId,updateData)=>{
        const service = await Service.findById(serviceId);
        if(!service){
            throw new Error("Service not Found");
        }
        if(updateData.categoryId){
            const category = await ServiceCategory.findById(updateData.categoryId);

            if(!category){
                throw new Error("category not found ")
            }
        }
        Object.assign(service,updateData);

        await service.save();
        return service
    
}

const deleteService = async (serviceId) => {
    const service = await Service.findById(serviceId);

    if (!service) {
        throw new Error("Service not found");
    }

    service.isActive = false;

    await service.save();

    return service;
};

const getServicesByCategory = async (categoryId) => {
    const services = await Service.find({
        categoryId,
        isActive: true
    });

    return services;
};


const getAllServicesForAdmin = async (page = 1, limit = 10, filters = {}) => {
    const query = {};
    const categoryId = filters.categoryId;
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';

    if (categoryId) query.categoryId = categoryId;

    if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');
        const matchingCategories = await ServiceCategory.find({ name: searchRegex }).distinct('_id');
        query.$or = [
            { name: searchRegex },
            { description: searchRegex },
            ...(matchingCategories.length ? [{ categoryId: { $in: matchingCategories } }] : [])
        ];
    }

    const totalServices = await Service.countDocuments(query);
    const totalPages = Math.ceil(totalServices / limit);
    const safePage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : 1;
    const skip = (safePage - 1) * limit;
    const services = await Service.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('categoryId', 'name');

    return { services, totalServices, page: safePage };
};

const getAllServiceCategories = async()=>{
    return ServiceCategory.find().sort({name:1});
};


export {
    getAllServices,
    addService,
    getServiceById,
    updateService,
    deleteService,
    getServicesByCategory,
    getAllServicesForAdmin,
    getAllServiceCategories
};

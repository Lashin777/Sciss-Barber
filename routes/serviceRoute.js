import express from 'express';
import  {getAllServicesController,
    addServiceController,
    getServiceByIdController,
    updateServiceController,
    deleteServiceController,
    getServicesByCategoryController,
    getAdminServicesPageController
} from '../controllers/ServiceController.js';
import { adminProtect, adminPageProtect, preventCache } from '../middlewares/authMiddleware.js';


const router = express.Router()



router.get('/api/services',getAllServicesController);
router.post('/api/admin/services',adminProtect,addServiceController);
router.get('/api/services/:id',getServiceByIdController);
router.put('/api/admin/services/:id', adminProtect, updateServiceController);
router.delete('/api/admin/services/:id',adminProtect,deleteServiceController);
router.get('/api/services/category/:categoryId',getServicesByCategoryController);
// Worked by Codex: redirect expired admin page sessions and prevent cached private content.
router.get('/admin/services', adminPageProtect, preventCache, getAdminServicesPageController)



export default router;

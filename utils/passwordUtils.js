import bcrypt from 'bcrypt';


const hashPassword = async (password) => {

    const createPassword = await bcrypt.hash(password, 10);

    return createPassword

}

const comparePassword = async (password, hashPassword) => {
    const compare = await bcrypt.compare(password, hashPassword);
    return compare;
}

export { hashPassword, comparePassword }
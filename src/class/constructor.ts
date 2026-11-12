type ClassConstructor = <T extends new (...args: any[]) => InstanceType<T>>(instance: T) => InstanceType<T>;

// Return the class constructor
export const classConstructor: ClassConstructor = (instance) => {
    return Object.getPrototypeOf(instance).constructor;
};

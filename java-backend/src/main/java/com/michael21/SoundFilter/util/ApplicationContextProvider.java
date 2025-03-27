package com.michael21.SoundFilter.util;

import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

@Component
public class ApplicationContextProvider implements ApplicationContextAware {
    private static ApplicationContext applicationContext;

    public static <T> T bean(Class<T> beanType) {
        return applicationContext.getBean(beanType);
    }

    public static Object bean(String beanName) {
        return applicationContext.getBean(beanName);
    }

    @Override
    public void setApplicationContext(ApplicationContext ac){
        applicationContext = ac;
    }
}

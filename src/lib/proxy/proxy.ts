"use strict";

import * as express from "express";
import * as StringUtils from "underscore.string";
import {ApiConfig} from "../config/api";
import {Proxy} from "../config/proxy";
import {ProxyFilter} from "./filter";
import {ProxyInterceptor} from "./interceptor";
import {Gateway} from "../gateway";

let proxy = require("express-http-proxy");

/**
 * The API Proxy system. It uses [[express-http-proxy]](https://github.com/villadora/express-http-proxy)
 * to proxy requests to a target API.
 */
export class ApiProxy {
    private filter: ProxyFilter;
    private interceptor: ProxyInterceptor;
    gateway: Gateway;

    constructor(gateway: Gateway) {
        this.gateway = gateway;
        this.filter = new ProxyFilter(this);
        this.interceptor = new ProxyInterceptor(this);
    }

    /**
     * Configure a proxy for a given API
     */
    proxy(api: ApiConfig, ) {
        this.gateway.server.use(api.proxy.path, proxy(api.proxy.target.path, this.configureProxy(api.proxy)));
    }
    
    private configureProxy(proxy: Proxy) {
        let result = {
            forwardPath: function(req: express.Request, res: express.Response) {
                return req.url;
            }
        };
        if (proxy.preserveHostHdr) {
            result['preserveHostHdr']  = proxy.preserveHostHdr; 
        }
        if (proxy.timeout) {
            result['timeout']  = proxy.timeout; 
        }
        if (proxy.https) {
            result['https']  = proxy.https; 
        }
        let filterChain: Array<Function> = this.filter.buildFilters(proxy);
        if (filterChain && filterChain.length > 0) {            
            result['filter'] = function(req, res) {
                let result = true;
                filterChain.forEach(f=>{
                    if (result) {
                        result = f(req, res);
                    } 
                });
                return result;
            }; 
        }
        let requestInterceptor: Function = this.interceptor.requestInterceptor(proxy);
        if (requestInterceptor) {            
            result['decorateRequest'] = requestInterceptor; 
        }
        let responseInterceptor: Function = this.interceptor.responseInterceptor(proxy);
        if (responseInterceptor) {            
            result['intercept'] = responseInterceptor; 
        }
        return result;
    }
}
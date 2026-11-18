package com.capstone.dsaplatform.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * The backend runs code that people submit, and there is no login. By default it therefore answers
 * only requests from this computer (127.0.0.1 or ::1, which is also where the Vite dev server's proxy
 * comes from); a laptop on the same Wi-Fi gets 403. The server still listens on every address, so
 * "localhost" stays fast whether it resolves to IPv4 or IPv6.
 * Docker sets LOCAL_ONLY=false, because there nginx reaches the backend from another container.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LocalOnlyFilter extends OncePerRequestFilter {

    private final boolean localOnly;

    public LocalOnlyFilter(@Value("${app.security.local-only:true}") boolean localOnly) {
        this.localOnly = localOnly;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!localOnly || isLoopback(request.getRemoteAddr())) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"FORBIDDEN\",\"message\":\"This backend only accepts requests from "
                + "the computer it runs on. Set LOCAL_ONLY=false to allow other computers.\"}");
    }

    static boolean isLoopback(String address) {
        if (address == null || address.isBlank()) {
            return false;
        }
        try {
            // The remote address is always a literal IP here, so this never does a DNS lookup.
            return InetAddress.getByName(address).isLoopbackAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }
}

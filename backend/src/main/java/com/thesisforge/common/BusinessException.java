package com.thesisforge.common;

/**
 * 业务异常。
 *
 * <p>默认状态码 500；需要语义化区分时（如资源不存在）可指定 code。</p>
 */
public class BusinessException extends RuntimeException {

    /** 业务状态码，默认 500 */
    private final Integer code;

    public BusinessException(String message) {
        this(500, message);
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.code = 500;
    }

    public Integer getCode() {
        return code;
    }
}

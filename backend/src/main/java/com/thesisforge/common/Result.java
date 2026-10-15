package com.thesisforge.common;

import lombok.Data;

/**
 * 统一响应体。
 */
@Data
public class Result<T> {

    /** 状态码，200 成功 */
    private Integer code;
    /** 提示信息 */
    private String msg;
    /** 数据 */
    private T data;

    public static <T> Result<T> ok() {
        return build(200, "操作成功", null);
    }

    public static <T> Result<T> ok(T data) {
        return build(200, "操作成功", data);
    }

    public static <T> Result<T> ok(T data, String msg) {
        return build(200, msg, data);
    }

    public static <T> Result<T> fail(String msg) {
        return build(500, msg, null);
    }

    public static <T> Result<T> fail(Integer code, String msg) {
        return build(code, msg, null);
    }

    private static <T> Result<T> build(Integer code, String msg, T data) {
        Result<T> r = new Result<>();
        r.setCode(code);
        r.setMsg(msg);
        r.setData(data);
        return r;
    }
}

-- ============================================================
-- ThesisForge 迁移 V7：校园二手交易平台业务表（前缀 xyesjy_）
-- 依据：docs/ai/system-design.md 第 4.2 节（15 张表）
-- 约定：所有「用户」引用字段统一存框架表 sys_user.id（业务资料在 xyesjy_user 扩展）
-- 状态用 TINYINT 数字枚举；金额统一 DECIMAL(12,2)；InnoDB + utf8mb4（与框架表一致）
-- ============================================================

-- 1. 业务用户资料（与 sys_user 一对一）
CREATE TABLE IF NOT EXISTS xyesjy_user (
    id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id      BIGINT       NOT NULL COMMENT '关联 sys_user.id',
    school       VARCHAR(100) DEFAULT NULL COMMENT '学校（校园认证填写）',
    student_no   VARCHAR(50)  DEFAULT NULL COMMENT '学号（校园认证填写）',
    cert_status  TINYINT      NOT NULL DEFAULT 0 COMMENT '校园认证状态 0未认证 1已认证',
    avatar       VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
    credit_score DECIMAL(3,1) DEFAULT NULL COMMENT '平均评分（评价表计算后冗余）',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_id (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '业务用户资料表';

-- 2. 商品分类
CREATE TABLE IF NOT EXISTS xyesjy_category (
    id          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
    name        VARCHAR(50) NOT NULL COMMENT '分类名（教材/电子产品/日用品…）',
    sort_order  INT         NOT NULL DEFAULT 0 COMMENT '排序号',
    status      TINYINT     NOT NULL DEFAULT 1 COMMENT '0禁用 1启用',
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '商品分类表';

-- 3. 商品
CREATE TABLE IF NOT EXISTS xyesjy_goods (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    seller_id     BIGINT       NOT NULL COMMENT '卖家（sys_user.id）',
    category_id   BIGINT       NOT NULL COMMENT '分类',
    title         VARCHAR(100) NOT NULL COMMENT '标题',
    description   TEXT         DEFAULT NULL COMMENT '描述',
    price         DECIMAL(12,2) NOT NULL COMMENT '价格',
    cover_image   VARCHAR(255) DEFAULT NULL COMMENT '封面图URL',
    status        TINYINT      NOT NULL DEFAULT 0 COMMENT '0待审核 1已上架 2已拒绝 3已下架 4已售出',
    reject_reason VARCHAR(255) DEFAULT NULL COMMENT '审核拒绝原因',
    view_count    INT          NOT NULL DEFAULT 0 COMMENT '浏览量',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_status (status),
    KEY idx_category (category_id),
    KEY idx_seller (seller_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '商品表';

-- 4. 商品图片（一商品多图）
CREATE TABLE IF NOT EXISTS xyesjy_goods_image (
    id         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    goods_id   BIGINT       NOT NULL COMMENT '所属商品',
    image_url  VARCHAR(255) NOT NULL COMMENT '图片相对URL',
    sort_order INT          NOT NULL DEFAULT 0 COMMENT '排序号（最多 9 张）',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_goods (goods_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '商品图片表';

-- 5. 收藏（用户-商品多对多）
CREATE TABLE IF NOT EXISTS xyesjy_favorite (
    id         BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id    BIGINT   NOT NULL COMMENT '收藏用户（sys_user.id）',
    goods_id   BIGINT   NOT NULL COMMENT '商品',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_goods (user_id, goods_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '收藏表';

-- 6. 求购信息
CREATE TABLE IF NOT EXISTS xyesjy_want (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id       BIGINT       NOT NULL COMMENT '发布者（sys_user.id）',
    content       VARCHAR(500) NOT NULL COMMENT '求购内容（想收什么）',
    budget        DECIMAL(12,2) DEFAULT NULL COMMENT '预算',
    status        TINYINT      NOT NULL DEFAULT 0 COMMENT '0待审核 1已发布 2已拒绝 3已关闭',
    reject_reason VARCHAR(255) DEFAULT NULL COMMENT '审核拒绝原因',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '求购信息表';

-- 7. 担保交易订单（核心表，一单一品）
CREATE TABLE IF NOT EXISTS xyesjy_order (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    order_no      VARCHAR(32)  NOT NULL COMMENT '业务订单号（展示用）',
    goods_id      BIGINT       NOT NULL COMMENT '商品（一单一品）',
    seller_id     BIGINT       NOT NULL COMMENT '卖家（冗余存，免联表）',
    buyer_id      BIGINT       NOT NULL COMMENT '买家',
    amount        DECIMAL(12,2) NOT NULL COMMENT '成交金额（下单时价格快照）',
    status        TINYINT      NOT NULL DEFAULT 0 COMMENT '0待付款 1已付款待交付 2已完成 3已取消',
    paid_at       DATETIME     DEFAULT NULL COMMENT '付款时间',
    completed_at  DATETIME     DEFAULT NULL COMMENT '完成时间',
    cancel_reason VARCHAR(255) DEFAULT NULL COMMENT '取消原因（超时/主动取消）',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_no (order_no),
    KEY idx_buyer (buyer_id),
    KEY idx_seller (seller_id),
    KEY idx_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '担保交易订单表';

-- 8. 钱包（一人一钱包）
CREATE TABLE IF NOT EXISTS xyesjy_wallet (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id       BIGINT       NOT NULL COMMENT '所属用户（一人一钱包）',
    balance       DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '可用余额',
    frozen_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '冻结金额（提现审核期间冻结）',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_id (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '虚拟钱包表';

-- 9. 钱包交易流水
CREATE TABLE IF NOT EXISTS xyesjy_wallet_transaction (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id       BIGINT       NOT NULL COMMENT '所属用户',
    amount        DECIMAL(12,2) NOT NULL COMMENT '变动金额（正=入账，负=出账）',
    balance_after DECIMAL(12,2) NOT NULL COMMENT '变动后余额（对账用）',
    biz_type      VARCHAR(20)  NOT NULL COMMENT '业务类型 RECHARGE/PAY/SETTLE/WITHDRAW/REFUND',
    biz_id        BIGINT       DEFAULT NULL COMMENT '关联业务id（订单/提现）',
    remark        VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '流水时间',
    PRIMARY KEY (id),
    KEY idx_user (user_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '钱包交易流水表';

-- 10. 提现申请
CREATE TABLE IF NOT EXISTS xyesjy_withdraw (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id       BIGINT       NOT NULL COMMENT '申请人',
    amount        DECIMAL(12,2) NOT NULL COMMENT '提现金额',
    status        TINYINT      NOT NULL DEFAULT 0 COMMENT '0处理中 1已完成 2已拒绝',
    reject_reason VARCHAR(255) DEFAULT NULL COMMENT '拒绝原因',
    auditor_id    BIGINT       DEFAULT NULL COMMENT '审核管理员（sys_user.id）',
    audited_at    DATETIME     DEFAULT NULL COMMENT '审核时间',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '提现申请表';

-- 11. 私信会话（两人一个会话）
CREATE TABLE IF NOT EXISTS xyesjy_chat_conversation (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_a_id       BIGINT       NOT NULL COMMENT '会话方A（约定小id存A）',
    user_b_id       BIGINT       NOT NULL COMMENT '会话方B',
    last_message    VARCHAR(500) DEFAULT NULL COMMENT '最后一条消息预览（会话列表展示）',
    last_message_at DATETIME     DEFAULT NULL COMMENT '最后消息时间（会话排序）',
    unread_a        INT          NOT NULL DEFAULT 0 COMMENT 'A的未读数',
    unread_b        INT          NOT NULL DEFAULT 0 COMMENT 'B的未读数',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users (user_a_id, user_b_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '私信会话表';

-- 12. 私信消息（必须落库，举报要有记录可查）
CREATE TABLE IF NOT EXISTS xyesjy_chat_message (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    conversation_id BIGINT       NOT NULL COMMENT '所属会话',
    sender_id       BIGINT       NOT NULL COMMENT '发送者',
    receiver_id     BIGINT       NOT NULL COMMENT '接收者（冗余，便于查未读）',
    content         VARCHAR(2000) NOT NULL COMMENT '消息内容',
    msg_type        TINYINT      NOT NULL DEFAULT 0 COMMENT '0文本 1图片',
    is_read         TINYINT      NOT NULL DEFAULT 0 COMMENT '0未读 1已读',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
    PRIMARY KEY (id),
    KEY idx_conversation (conversation_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '私信消息表';

-- 13. 交易评价（一单两条记录=买卖互评）
CREATE TABLE IF NOT EXISTS xyesjy_review (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    order_id    BIGINT       NOT NULL COMMENT '所属订单',
    reviewer_id BIGINT       NOT NULL COMMENT '评价人',
    reviewee_id BIGINT       NOT NULL COMMENT '被评价人',
    rating      TINYINT      NOT NULL COMMENT '评分 1-5 星',
    content     VARCHAR(500) DEFAULT NULL COMMENT '文字评价',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_reviewer (order_id, reviewer_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '交易评价表';

-- 14. 举报记录
CREATE TABLE IF NOT EXISTS xyesjy_report (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    reporter_id   BIGINT       NOT NULL COMMENT '举报人',
    report_type   TINYINT      NOT NULL COMMENT '0商品 1私信消息 2用户',
    target_id     BIGINT       NOT NULL COMMENT '被举报对象id（商品/消息/用户）',
    reason        VARCHAR(500) NOT NULL COMMENT '举报理由',
    status        TINYINT      NOT NULL DEFAULT 0 COMMENT '0待处理 1已处理',
    handle_result VARCHAR(255) DEFAULT NULL COMMENT '处理结果（如：商品已下架、用户已禁言）',
    handler_id    BIGINT       DEFAULT NULL COMMENT '处理管理员',
    handled_at    DATETIME     DEFAULT NULL COMMENT '处理时间',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '举报时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '举报记录表';

-- 15. 站内通知（可选加分项）
CREATE TABLE IF NOT EXISTS xyesjy_notification (
    id         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id    BIGINT       NOT NULL COMMENT '接收人',
    title      VARCHAR(100) DEFAULT NULL COMMENT '标题',
    content    VARCHAR(500) DEFAULT NULL COMMENT '内容',
    biz_type   VARCHAR(20)  DEFAULT NULL COMMENT '类型 ORDER/GOODS/WANT/CHAT',
    is_read    TINYINT      NOT NULL DEFAULT 0 COMMENT '0未读 1已读',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '通知时间',
    PRIMARY KEY (id),
    KEY idx_user (user_id, is_read)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '站内通知表';

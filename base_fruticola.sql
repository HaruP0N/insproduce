CREATE TABLE [dbo].[assignments] (
    [id]          INT            IDENTITY (1, 1) NOT NULL,
    [user_id]     INT            NOT NULL,
    [producer]    VARCHAR (100)  NULL,
    [lot]         VARCHAR (50)   NOT NULL,
    [variety]     VARCHAR (50)   NULL,
    [status]      VARCHAR (20)   CONSTRAINT [DF_assign_status] DEFAULT ('pendiente') NOT NULL,
    [created_at]  DATETIME2 (7)  CONSTRAINT [DF_assign_created] DEFAULT (sysutcdatetime()) NOT NULL,
    [notes_admin] NVARCHAR (MAX) NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [CK_assign_status] CHECK ([status]='completada' OR [status]='pendiente'),
    CONSTRAINT [FK_assign_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users] ([id])
);


GO

CREATE TABLE [dbo].[metric_fields] (
    [id]          INT             IDENTITY (1, 1) NOT NULL,
    [template_id] INT             NOT NULL,
    [key]         VARCHAR (80)    NOT NULL,
    [label]       VARCHAR (120)   NOT NULL,
    [field_type]  VARCHAR (20)    NOT NULL,
    [required]    BIT             CONSTRAINT [DF_fields_required] DEFAULT ((0)) NOT NULL,
    [unit]        VARCHAR (20)    NULL,
    [min_value]   DECIMAL (18, 2) NULL,
    [max_value]   DECIMAL (18, 2) NULL,
    [options]     NVARCHAR (MAX)  CONSTRAINT [DF_fields_options] DEFAULT ('[]') NOT NULL,
    [order_index] INT             CONSTRAINT [DF_fields_order] DEFAULT ((0)) NOT NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [CK_fields_type] CHECK ([field_type]='boolean' OR [field_type]='select' OR [field_type]='text' OR [field_type]='number'),
    CONSTRAINT [FK_fields_template] FOREIGN KEY ([template_id]) REFERENCES [dbo].[metric_templates] ([id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_fields_template_key] UNIQUE NONCLUSTERED ([template_id] ASC, [key] ASC)
);


GO

CREATE TABLE [dbo].[inspection_pdfs] (
    [inspection_id] INT            NOT NULL,
    [status]        VARCHAR (20)   CONSTRAINT [DF_pdfs_status] DEFAULT ('PENDING') NOT NULL,
    [pdf_url]       NVARCHAR (MAX) NULL,
    [pdf_hash]      VARCHAR (128)  NULL,
    [updated_at]    DATETIME2 (7)  NULL,
    [error_message] NVARCHAR (MAX) NULL,
    PRIMARY KEY CLUSTERED ([inspection_id] ASC),
    CONSTRAINT [CK_pdfs_status] CHECK ([status]='ERROR' OR [status]='OK' OR [status]='PENDING'),
    CONSTRAINT [FK_pdfs_inspection] FOREIGN KEY ([inspection_id]) REFERENCES [dbo].[inspections] ([id]) ON DELETE CASCADE
);


GO

CREATE TABLE [dbo].[metric_templates] (
    [id]           INT           IDENTITY (1, 1) NOT NULL,
    [commodity_id] INT           NOT NULL,
    [version]      INT           CONSTRAINT [DF_templates_version] DEFAULT ((1)) NOT NULL,
    [name]         VARCHAR (120) NOT NULL,
    [active]       BIT           CONSTRAINT [DF_templates_active] DEFAULT ((1)) NOT NULL,
    [created_at]   DATETIME2 (7) CONSTRAINT [DF_templates_created] DEFAULT (sysutcdatetime()) NOT NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_templates_commodity] FOREIGN KEY ([commodity_id]) REFERENCES [dbo].[commodities] ([id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_templates_commodity_version] UNIQUE NONCLUSTERED ([commodity_id] ASC, [version] ASC)
);


GO

CREATE TABLE [dbo].[users] (
    [id]            INT           IDENTITY (1, 1) NOT NULL,
    [name]          VARCHAR (100) NULL,
    [email]         VARCHAR (150) NOT NULL,
    [password_hash] VARCHAR (255) NOT NULL,
    [role]          VARCHAR (20)  NOT NULL,
    [active]        BIT           CONSTRAINT [DF_users_active] DEFAULT ((1)) NOT NULL,
    [created_at]    DATETIME2 (7) CONSTRAINT [DF_users_created] DEFAULT (sysutcdatetime()) NOT NULL,
    [updated_at]    DATETIME2 (7) CONSTRAINT [DF_users_updated] DEFAULT (sysutcdatetime()) NOT NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [CK_users_role] CHECK ([role]='inspector' OR [role]='admin'),
    CONSTRAINT [UQ_users_email] UNIQUE NONCLUSTERED ([email] ASC)
);


GO

CREATE TABLE [dbo].[inspections] (
    [id]                 INT             IDENTITY (1, 1) NOT NULL,
    [created_at]         DATETIME2 (7)   CONSTRAINT [DF_inspections_created] DEFAULT (sysutcdatetime()) NOT NULL,
    [updated_at]         DATETIME2 (7)   CONSTRAINT [DF_inspections_updated] DEFAULT (sysutcdatetime()) NOT NULL,
    [commodity_id]       INT             NOT NULL,
    [created_by_user_id] INT             NULL,
    [producer]           VARCHAR (255)   NULL,
    [lot]                VARCHAR (80)    NULL,
    [variety]            VARCHAR (120)   NULL,
    [caliber]            VARCHAR (50)    NULL,
    [packaging_code]     VARCHAR (100)   NULL,
    [packaging_type]     VARCHAR (100)   NULL,
    [packaging_date]     DATE            NULL,
    [net_weight]         DECIMAL (10, 2) NULL,
    [brix_avg]           DECIMAL (6, 2)  NULL,
    [temp_water]         DECIMAL (6, 2)  NULL,
    [temp_ambient]       DECIMAL (6, 2)  NULL,
    [temp_pulp]          DECIMAL (6, 2)  NULL,
    [notes]              NVARCHAR (MAX)  NULL,
    [metrics]            NVARCHAR (MAX)  CONSTRAINT [DF_inspections_metrics] DEFAULT ('{}') NOT NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_inspections_commodity] FOREIGN KEY ([commodity_id]) REFERENCES [dbo].[commodities] ([id]),
    CONSTRAINT [FK_inspections_created_by] FOREIGN KEY ([created_by_user_id]) REFERENCES [dbo].[users] ([id]) ON DELETE SET NULL
);


GO

CREATE TABLE [dbo].[commodities] (
    [id]         INT           IDENTITY (1, 1) NOT NULL,
    [code]       VARCHAR (50)  NOT NULL,
    [name]       VARCHAR (100) NOT NULL,
    [active]     BIT           CONSTRAINT [DF_commodities_active] DEFAULT ((1)) NOT NULL,
    [created_at] DATETIME2 (7) CONSTRAINT [DF_commodities_created] DEFAULT (sysutcdatetime()) NOT NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    UNIQUE NONCLUSTERED ([code] ASC)
);


GO

CREATE TABLE [dbo].[inspection_photos] (
    [id]            INT            IDENTITY (1, 1) NOT NULL,
    [inspection_id] INT            NOT NULL,
    [url]           NVARCHAR (MAX) NOT NULL,
    [label]         VARCHAR (100)  NULL,
    [created_at]    DATETIME2 (7)  CONSTRAINT [DF_photos_created] DEFAULT (sysutcdatetime()) NOT NULL,
    PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_photos_inspection] FOREIGN KEY ([inspection_id]) REFERENCES [dbo].[inspections] ([id]) ON DELETE CASCADE
);


GO


CREATE VIEW dbo.vw_inspections_admin AS
SELECT
  i.id,
  i.created_at,
  i.updated_at,
  i.producer,
  i.lot,
  i.variety,
  i.caliber,
  i.packaging_code,
  i.packaging_type,
  i.packaging_date,
  i.net_weight,
  i.brix_avg,
  i.temp_water,
  i.temp_ambient,
  i.temp_pulp,
  i.notes,
  i.metrics,
  i.created_by_user_id,
  c.code AS commodity_code,
  c.name AS commodity_name,
  p.status AS pdf_status,
  p.pdf_url,
  p.pdf_hash
FROM dbo.inspections i
JOIN dbo.commodities c ON c.id = i.commodity_id
LEFT JOIN dbo.inspection_pdfs p ON p.inspection_id = i.id;

GO

CREATE NONCLUSTERED INDEX [idx_fields_template_order]
    ON [dbo].[metric_fields]([template_id] ASC, [order_index] ASC);


GO

CREATE NONCLUSTERED INDEX [idx_inspections_created_at]
    ON [dbo].[inspections]([created_at] DESC);


GO


CREATE TRIGGER dbo.trg_users_updated_at
ON dbo.users
AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE u SET updated_at = SYSUTCDATETIME()
  FROM dbo.users u
  INNER JOIN inserted i ON i.id = u.id;
END

GO


CREATE TRIGGER dbo.trg_inspections_updated_at
ON dbo.inspections
AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE t SET updated_at = SYSUTCDATETIME()
  FROM dbo.inspections t
  INNER JOIN inserted i ON i.id = t.id;
END

GO
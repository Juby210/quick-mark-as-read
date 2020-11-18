const { Plugin } = require('powercord/entities')
const { Icon } = require('powercord/components')
const { getModule, getModuleByDisplayName, i18n: { Messages }, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

module.exports = class QuickMarkAsRead extends Plugin {
    buttons = []

    async startPlugin() {
        const _this = this
        const classes = {
            ...await getModule(['addButton', 'clickable', 'wrapper']),
            ...await getModule(['iconItem'])
        }
        const { ack, ackCategory } = await getModule(['ack', 'ackCategory'])
        const { hasCategoryUnread } = await getModule(['hasCategoryUnread'])
        const Tooltip = await getModuleByDisplayName('Tooltip')

        const ChannelItem = await getModule(m => m.default && m.default.displayName == 'ChannelItem')
        inject('qmar', ChannelItem, 'default', args => {
            this.buttons.filter(b => b.props.channelId == args[0]?.channel?.parent_id).forEach(b => b.forceUpdate())
            if (!args[0]?.unread || args[0].children.find(c => c?.props?.__qmar)) return args
            args[0].children.unshift(React.createElement(
                'div', { className: classes.iconItem, __qmar: true }, React.createElement(
                    Tooltip, { text: Messages.MARK_AS_READ }, props => React.createElement(Icon, {
                        ...props,
                        name: 'ChatCheck',
                        className: classes.actionIcon,
                        width: 16,
                        height: 16,
                        onClick: () => ack(args[0].channel.id)
                    })
                )
            ))
            return args
        }, true)
        ChannelItem.default.displayName = 'ChannelItem'

        class QMARCategoryButton extends React.PureComponent {
            constructor(props) {
                super(props)

                _this.buttons.push(this)
            }

            componentWillUnmount() {
                const i = _this.buttons.indexOf(this)
                if (i != -1) _this.buttons.splice(i, 1)
            }

            render() {
                if (hasCategoryUnread(this.props.channelId)) return React.createElement(
                    Tooltip,
                    { text: Messages.MARK_AS_READ },
                    props => React.createElement(Icon, {
                        ...props,
                        name: 'ChatCheck',
                        className: classes.actionIcon,
                        style: { zIndex: 1 },
                        width: 18,
                        onClick: () => ackCategory(this.props.channelId)
                    })
                )
                return null
            }
        }

        const { iconVisibility } = await getModule(['addButton', 'iconVisibility'])
        const FocusRing = await getModule(['FocusRingScope'])
        inject('qmar-category', FocusRing, 'default', args => {
            if (!args[0]?.children?.props?.className ||
                args[0].children.props.className.indexOf(`${iconVisibility} ${classes.wrapper}`) === -1) return args
            const { children } = args[0].children.props || [], { props } = children[1] || {}
            if (!props) return args
            if (!Array.isArray(props.children)) props.children = [ props.children ]
            if (props.children.find(c => c?.type?.name == 'QMARCategoryButton')) return args

            try {
                props.children.unshift(React.createElement(QMARCategoryButton, { channelId: children[0].props['data-list-item-id'].split('_').pop() }))
            } catch (e) {
                this.error('Failed to add category button', e)
            }

            return args
        }, true)
    }

    pluginWillUnload() {
        uninject('qmar')
        uninject('qmar-category')
    }
}
